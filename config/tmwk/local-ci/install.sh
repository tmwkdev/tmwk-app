#!/bin/zsh
# Sets up (or removes) the tmwk nightly on this Mac. See docs/tmwk/local-ci-plan.md.
# Usage: install.sh [<runner-ref>] | install.sh --uninstall
emulate -L zsh
setopt err_exit pipe_fail no_unset

CI_ROOT="${TMWK_CI_ROOT:-$HOME/ci}"
MIRROR="$CI_ROOT/tmwk-app.git"
RUNNER="$CI_ROOT/runner"
AGENTS="$HOME/Library/LaunchAgents"
DOMAIN="gui/$(id -u)"
LABELS=(dev.tmwk.nightly dev.tmwk.nightly-deliver)

if [[ "${1:-}" == --uninstall ]]; then
  for label in $LABELS; do
    launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
    rm -f "$AGENTS/$label.plist"
  done
  print "Removed ${LABELS[*]}. $CI_ROOT is left in place; delete it by hand if you want the disk back."
  exit 0
fi

mkdir -p "$CI_ROOT/work" "$CI_ROOT/nightly/runs" "$CI_ROOT/nightly/outbox"
if [[ ! -d "$MIRROR" ]]; then
  git clone --bare --quiet git@github.com:tmwkdev/tmwk-app.git "$MIRROR"
  git --git-dir="$MIRROR" config remote.origin.fetch '+refs/heads/*:refs/heads/*'
fi
# Upstream is fetch-only, for syncs and the upstream tripwire; pushing to it is disabled.
if ! git --git-dir="$MIRROR" remote get-url upstream >/dev/null 2>&1; then
  git --git-dir="$MIRROR" remote add upstream https://github.com/stablyai/orca.git
  git --git-dir="$MIRROR" remote set-url --push upstream DISABLED
fi
git --git-dir="$MIRROR" fetch --prune --quiet origin

ref="${1:-main}"
if [[ -d "$RUNNER" ]]; then
  git -C "$RUNNER" checkout --quiet --detach "$ref"
else
  git --git-dir="$MIRROR" worktree add --quiet --detach "$RUNNER" "$ref"
fi
script="$RUNNER/config/tmwk/local-ci/nightly.sh"
[[ -x "$script" ]] || { print "No nightly.sh at $ref"; exit 1 }

write_agent() {
  local label=$1 subcommand=$2 schedule=$3
  cat >"$AGENTS/$label.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>$script</string><string>$subcommand</string></array>
  $schedule
  <key>ProcessType</key><string>Standard</string>
  <key>Nice</key><integer>10</integer>
  <key>LowPriorityIO</key><true/>
  <key>StandardOutPath</key><string>$CI_ROOT/nightly/$label.log</string>
  <key>StandardErrorPath</key><string>$CI_ROOT/nightly/$label.log</string>
</dict>
</plist>
EOF
  plutil -lint -s "$AGENTS/$label.plist"
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  launchctl bootstrap "$DOMAIN" "$AGENTS/$label.plist"
}

# 00:30 local time (America/Chicago on the MBP); launchd runs a missed slot once on wake.
write_agent dev.tmwk.nightly run \
  '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>0</integer><key>Minute</key><integer>30</integer></dict>'
write_agent dev.tmwk.nightly-deliver deliver '<key>StartInterval</key><integer>1800</integer>'

print "Installed ${LABELS[*]}; runner at $(git -C "$RUNNER" rev-parse --short HEAD)."
print "Run now: launchctl kickstart $DOMAIN/dev.tmwk.nightly   Status: $script status"
