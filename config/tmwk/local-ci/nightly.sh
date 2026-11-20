#!/bin/zsh
# tmwk nightly CI on the always-on MBP. See docs/tmwk/local-ci-plan.md.
# Usage: nightly.sh run | deliver | status [<run-dir-name>]
emulate -L zsh
setopt pipe_fail no_unset

CI_ROOT="${TMWK_CI_ROOT:-$HOME/ci}"
MIRROR="$CI_ROOT/tmwk-app.git"
WORK="$CI_ROOT/work/nightly"
RUNNER="$CI_ROOT/runner"
STATE="$CI_ROOT/nightly"
REPO="tmwkdev/tmwk-app"
ORCA="$HOME/.orca/cli/bin/orca"
STATUS_CONTEXT="tmwk/nightly"
ISSUE_TITLE="Nightly: main is red"
# Optional settings: TMWK_HOME_ENV=<saved orca environment of the home host>.
[[ -f "$STATE/config" ]] && source "$STATE/config"
TMWK_HOME_ENV="${TMWK_HOME_ENV:-}"

log() { print -r -- "[nightly $(date '+%H:%M:%S')] $*" }

# Runs one step with a hard limit, killing its whole process tree on timeout.
run_step() {
  local name=$1 limit_min=$2
  shift 2
  local out="$RUN_DIR/$name.log" start=$SECONDS rc
  log "step $name: $*"
  ( cd "$WORK" && exec "$@" ) >"$out" 2>&1 &
  local pid=$!
  ( sleep $(( limit_min * 60 )); print "TIMEOUT after ${limit_min} min" >>"$out"; kill_tree $pid ) &
  local watchdog=$!
  wait $pid
  rc=$?
  kill_tree $watchdog
  wait $watchdog 2>/dev/null
  local secs=$(( SECONDS - start ))
  log "step $name: rc=$rc ${secs}s"
  print -r -- "$name $rc $secs" >>"$RUN_DIR/steps.txt"
  return $rc
}

kill_tree() {
  local child
  for child in $(pgrep -P "$1"); do kill_tree "$child"; done
  kill -TERM "$1" 2>/dev/null
}

failed_steps() { awk '$2 != 0 { print $1 }' "$RUN_DIR/steps.txt" }

failed_test_files() {
  local json="$RUN_DIR/vitest.json"
  [[ -s "$json" ]] || return 0
  jq -r --arg root "$WORK/" '.testResults[] | select(.status == "failed") | .name | ltrimstr($root)' "$json" | sort -u
}

write_summary() {
  local sha=$1 base=$2 state=$3
  jq -n --arg date "$RUN_NAME" --arg sha "$sha" --arg base "$base" --arg state "$state" \
    --rawfile steps "$RUN_DIR/steps.txt" \
    --rawfile failed "$RUN_DIR/failed-tests.txt" \
    --rawfile newly "$RUN_DIR/new-failed-tests.txt" \
    --rawfile fixed "$RUN_DIR/fixed-tests.txt" '
    def lines: split("\n") | map(select(length > 0));
    { date: $date, sha: $sha, base: $base, state: $state,
      steps: ($steps | lines | map(split(" ") | { name: .[0], rc: (.[1] | tonumber), secs: (.[2] | tonumber) })),
      failedTests: ($failed | lines), newFailedTests: ($newly | lines), fixedTests: ($fixed | lines) }' \
    >"$RUN_DIR/summary.json"
}

post_status() {
  local sha=$1 state=$2 description=$3
  gh api -X POST "repos/$REPO/statuses/$sha" -f context="$STATUS_CONTEXT" -f state="$state" \
    -f description="${description[1,139]}" >/dev/null || log "WARNING: could not post commit status"
}

open_issue_number() {
  gh issue list --repo "$REPO" --label nightly --state open --search "in:title \"$ISSUE_TITLE\"" \
    --json number --jq '.[0].number // empty' 2>/dev/null
}

# Public repo: step names, test file names, SHAs and the MBP log path only. Never log text.
public_report() {
  local sha=$1 base=$2
  print -r -- "**Red night $RUN_NAME** at \`$sha\` (changes since \`$base\`)."
  print
  print -r -- "Failing steps: $(failed_steps | paste -sd, - | sed 's/,/, /g')"
  if [[ -s "$RUN_DIR/new-failed-tests.txt" ]]; then
    print; print "Newly failing test files:"; sed 's/^/- `/; s/$/`/' "$RUN_DIR/new-failed-tests.txt"
  fi
  if [[ -s "$RUN_DIR/fixed-tests.txt" ]]; then
    print; print "Fixed since last night:"; sed 's/^/- `/; s/$/`/' "$RUN_DIR/fixed-tests.txt"
  fi
  print; print -r -- "$(wc -l <"$RUN_DIR/failed-tests.txt" | tr -d ' ') test files failing in total."
  print -r -- "Logs on the MBP: \`~/ci/nightly/runs/$RUN_NAME/\` (\`~/ci/runner/config/tmwk/local-ci/nightly.sh status $RUN_NAME\`)."
}

fallback_issue() {
  local body=$1 number
  number=$(open_issue_number)
  if [[ -n "$number" ]]; then
    gh issue comment "$number" --repo "$REPO" --body "$body" >/dev/null && log "commented on issue #$number"
  else
    gh issue create --repo "$REPO" --title "$ISSUE_TITLE" --label nightly --body "$body" >/dev/null \
      && log "opened fallback issue"
  fi
}

close_fallback_issue() {
  local reason=$1 number
  number=$(open_issue_number)
  [[ -n "$number" ]] && gh issue close "$number" --repo "$REPO" --comment "$reason" >/dev/null \
    && log "closed issue #$number"
}

# The ticket can carry log tails: it lives only in the owner's Orca.
ticket_spec() {
  local sha=$1 base=$2 step
  print -r -- "The tmwk nightly on the MBP failed on main at $sha (changes since $base)."
  print -r -- "Fix main, or say which failures are expected. Full logs: ssh mbp, then"
  print -r -- "~/ci/runner/config/tmwk/local-ci/nightly.sh status $RUN_NAME"
  print
  public_report "$sha" "$base" | tail -n +3
  for step in $(failed_steps); do
    print; print -r -- "--- last 40 lines of $step ---"
    tail -n 40 "$RUN_DIR/$step.log" | sed 's/\x1b\[[0-9;]*m//g'
  done
}

orca_home() { "$ORCA" "$@" --environment "$TMWK_HOME_ENV" --json --full }

home_main_run() {
  orca_home orchestration run-list | jq -r '.result.runs[] | select(.objective | ascii_downcase | gsub("^\\s+|\\s+$"; "") == "main") | .id' | head -1
}

# Delivers one outbox entry as a failed Task in the home host's `main` Run (a stop in Needs you).
deliver_ticket() {
  local entry=$1 run task title result request
  [[ -n "$TMWK_HOME_ENV" ]] || return 1
  run=$(home_main_run) || return 1
  [[ -n "$run" ]] || { log "home host has no main Run"; return 1 }
  title=$(jq -r .title "$entry"); result=$(jq -r .result "$entry"); request=$(jq -r .request "$entry")
  task=$(jq -r '.task // empty' "$entry")
  if [[ -z "$task" ]]; then
    task=$(jq -r .spec "$entry" | orca_home orchestration task-create --run "$run" --task-title "$title" \
      --spec-file - --retry-request "$request" | jq -r '.result.task.id // empty') || return 1
    [[ -n "$task" ]] || return 1
    jq --arg task "$task" '.task = $task' "$entry" >"$entry.tmp" && mv "$entry.tmp" "$entry"
  fi
  orca_home orchestration task-update --run "$run" --id "$task" --status failed --result "$result" \
    --retry-request "$request-failed" >/dev/null || return 1
  local previous_task=""
  [[ -s "$STATE/open-ticket" ]] && previous_task=$(awk '{print $1}' "$STATE/open-ticket")
  if [[ -n "$previous_task" && "$previous_task" != "$task" ]]; then
    orca_home orchestration task-update --run "$run" --id "$previous_task" --status completed \
      --result "Superseded by $task." >/dev/null || log "could not close superseded ticket $previous_task"
  fi
  print -r -- "$task $(jq -r .signature "$entry")" >"$STATE/open-ticket"
  log "ticket $task delivered to $TMWK_HOME_ENV"
}

complete_open_ticket() {
  local sha=$1 task run
  [[ -s "$STATE/open-ticket" && -n "$TMWK_HOME_ENV" ]] || return 0
  task=$(awk '{print $1}' "$STATE/open-ticket")
  run=$(home_main_run) && [[ -n "$run" ]] || return 1
  orca_home orchestration task-update --run "$run" --id "$task" --status completed \
    --result "Nightly green at ${sha[1,7]}." >/dev/null || return 1
  rm -f "$STATE/open-ticket"
  log "completed ticket $task"
}

cmd_deliver() {
  local entry delivered=0
  for entry in "$STATE"/outbox/*.json(N); do
    if deliver_ticket "$entry"; then
      rm -f "$entry"; delivered=1
    else
      log "home host unreachable; $entry stays queued"
    fi
  done
  (( delivered )) && close_fallback_issue "The nightly ticket reached the main chat's Needs you; closing this fallback."
  return 0
}

report_red() {
  local sha=$1 base=$2 signature request entry open_sig="" open_task=""
  signature=$( { failed_steps; cat "$RUN_DIR/new-failed-tests.txt" } | shasum | cut -c1-12)
  if [[ -s "$STATE/open-ticket" ]]; then
    read -r open_task open_sig <"$STATE/open-ticket"
  fi
  request="nightly-$RUN_NAME"
  entry="$STATE/outbox/$RUN_NAME.json"
  local steps_csv=$(failed_steps | paste -sd, -)
  local result="Failed: $steps_csv at ${sha[1,7]} ($RUN_NAME). Logs: ~/ci/nightly/runs/$RUN_NAME on the MBP."
  jq -n --arg title "Nightly red: main@${sha[1,7]} ($steps_csv)" --arg spec "$(ticket_spec "$sha" "$base")" \
    --arg result "$result" --arg signature "$signature" --arg request "$request" \
    --arg task "$([[ "$open_sig" == "$signature" ]] && print -r -- "$open_task")" \
    '{title: $title, spec: $spec, result: $result, signature: $signature, request: $request}
     + (if $task == "" then {} else {task: $task} end)' >"$entry"
  if deliver_ticket "$entry"; then
    rm -f "$entry"
    close_fallback_issue "The nightly ticket reached the main chat's Needs you; closing this fallback."
  else
    log "ticket queued in outbox; using the GitHub issue fallback"
    fallback_issue "$(public_report "$sha" "$base")"
  fi
}

cmd_run() {
  mkdir -p "$STATE/runs" "$STATE/outbox"
  if ! mkdir "$STATE/lock" 2>/dev/null; then
    if [[ -n $(find "$STATE/lock" -maxdepth 0 -mmin +360) ]]; then
      log "removing a stale lock (older than 6 h)"
      rm -rf "$STATE/lock"; mkdir "$STATE/lock" || exit 1
    else
      log "another nightly run holds the lock; exiting"; exit 0
    fi
  fi
  trap 'rm -rf "$STATE/lock"' EXIT INT TERM

  git --git-dir="$MIRROR" fetch --prune --quiet origin || { log "fetch failed"; exit 1 }
  local sha=$(git --git-dir="$MIRROR" rev-parse refs/heads/main)
  if [[ -z "${NIGHTLY_FORCE:-}" && -f "$STATE/last-run-sha" && "$(<"$STATE/last-run-sha")" == "$sha" ]]; then
    log "main is still ${sha[1,7]}; nothing new to check"
    cmd_deliver
    exit 0
  fi
  local base
  if [[ -s "$STATE/last-green-sha" ]] && git --git-dir="$MIRROR" merge-base --is-ancestor "$(<"$STATE/last-green-sha")" "$sha"; then
    base=$(<"$STATE/last-green-sha")
  else
    base=$(git --git-dir="$MIRROR" rev-parse "$sha~1")
  fi

  RUN_NAME="$(date +%Y-%m-%d-%H%M)-${sha[1,7]}"
  RUN_DIR="$STATE/runs/$RUN_NAME"
  mkdir -p "$RUN_DIR"
  : >"$RUN_DIR/steps.txt"
  log "run $RUN_NAME: main ${sha[1,7]}, changes since ${base[1,7]}"

  if [[ -d "$WORK" ]]; then
    git -C "$WORK" checkout --quiet --force --detach "$sha"
    git -C "$WORK" clean -fdxq -e node_modules
  else
    git --git-dir="$MIRROR" worktree add --quiet --detach "$WORK" "$sha"
  fi

  export ORCA_BACKGROUND_LAUNCH=1 NODE_OPTIONS=--max-old-space-size=4096 ORCA_CODE_QUALITY_BASE="$base"
  unset CI

  # Both arches: build:mac packages x64 and arm64, which need each arch's native variants.
  run_step install 20 zsh -c 'pnpm install:release && cd mobile && pnpm install --frozen-lockfile'
  run_step check-changed 60 pnpm check:changed --base="$base" --maxWorkers=2
  run_step tc 45 pnpm tc
  run_step lint 45 pnpm lint
  run_step unit 120 pnpm test --maxWorkers=2 --reporter=default --reporter=json \
    --outputFile.json="$RUN_DIR/vitest.json"
  run_step build-mac 90 pnpm build:mac
  (( ${NIGHTLY_FORCE_FAIL:-0} )) && print -r -- "forced-fail 1 0" >>"$RUN_DIR/steps.txt"

  failed_test_files >"$RUN_DIR/failed-tests.txt"
  local previous="$STATE/previous-failed-tests.txt"
  [[ -f "$previous" ]] || : >"$previous"
  comm -13 "$previous" "$RUN_DIR/failed-tests.txt" >"$RUN_DIR/new-failed-tests.txt"
  comm -23 "$previous" "$RUN_DIR/failed-tests.txt" >"$RUN_DIR/fixed-tests.txt"
  # A unit step that never wrote JSON tells us nothing about which files pass.
  [[ -s "$RUN_DIR/vitest.json" ]] && cp "$RUN_DIR/failed-tests.txt" "$previous"

  local state=success
  [[ -n "$(failed_steps)" ]] && state=failure
  write_summary "$sha" "$base" "$state"
  print -r -- "$sha" >"$STATE/last-run-sha"
  ln -sfn "$RUN_DIR" "$STATE/latest"

  local new_count=$(wc -l <"$RUN_DIR/new-failed-tests.txt" | tr -d ' ')
  if [[ $state == success ]]; then
    print -r -- "$sha" >"$STATE/last-green-sha"
    post_status "$sha" success "All nightly steps passed ($RUN_NAME)"
    complete_open_ticket "$sha" || log "could not complete the open ticket; it stays open"
    close_fallback_issue "Green at \`$sha\` ($RUN_NAME)."
  else
    post_status "$sha" failure "Failed: $(failed_steps | paste -sd, - | sed 's/,/, /g'); $new_count new failing test files"
    report_red "$sha" "$base"
  fi

  find "$STATE/runs" -mindepth 1 -maxdepth 1 -mtime +14 -exec rm -rf {} +
  [[ $(date +%u) == 7 ]] && pnpm store prune >/dev/null 2>&1
  update_runner
  log "run $RUN_NAME done: $state"
}

# Moves the runner checkout to main once main carries this script; takes effect next night.
update_runner() {
  [[ -d "$RUNNER" ]] || return 0
  local main=$(git --git-dir="$MIRROR" rev-parse refs/heads/main)
  if git --git-dir="$MIRROR" cat-file -e "$main:config/tmwk/local-ci/nightly.sh" 2>/dev/null; then
    git -C "$RUNNER" checkout --quiet --detach "$main" && log "runner now at main ${main[1,7]}"
  fi
}

cmd_status() {
  local dir="$STATE/latest"
  [[ -n "${1:-}" ]] && dir="$STATE/runs/$1"
  [[ -f "$dir/summary.json" ]] || { print "No summary at $dir"; return 1 }
  jq -r '"\(.date)  \(.state)  main \(.sha[0:7]) since \(.base[0:7])",
    (.steps[] | "  \(.name)\t\(if .rc == 0 then "ok" else "FAILED rc=\(.rc)" end)\t\(.secs / 60 | floor)m\(.secs % 60)s"),
    "  failing test files: \(.failedTests | length) (new \(.newFailedTests | length), fixed \(.fixedTests | length))",
    (.newFailedTests[] | "    new: \(.)")' "$dir/summary.json"
  print "  logs: $dir"
}

case "${1:-}" in
  run) cmd_run ;;
  deliver) cmd_deliver ;;
  status) cmd_status "${2:-}" ;;
  *) print "Usage: nightly.sh run | deliver | status [<run>]"; exit 2 ;;
esac
