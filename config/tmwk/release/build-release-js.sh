#!/usr/bin/env bash
# Builds the release JS with tmwk's PostHog key in the build env only. Usage: build-release-js.sh [command...]
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$root"
identity="src/shared/tmwk/identity"
read_json() { node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log(process.argv[2].split('.').reduce((v,k)=>v[k],j))" "$1" "$2"; }

service="$(read_json $identity/tmwk-posthog.json keySource.keychainService)"
account="$(read_json $identity/tmwk-posthog.json keySource.keychainAccount)"
build_env="$(read_json $identity/tmwk-posthog.json keySource.buildEnv)"
expected="$(read_json $identity/tmwk-release-egress-check.json posthogWriteKeySha256)"

key="$(security find-generic-password -s "$service" -a "$account" -w)"
actual="$(printf %s "$key" | shasum -a 256 | cut -d' ' -f1)"
if [ "$actual" != "$expected" ]; then
  echo "Keychain item $service/$account does not match posthogWriteKeySha256; refusing to build." >&2
  exit 1
fi

unset ORCA_DIAGNOSTICS_TOKEN_URL
export ORCA_BUILD_IDENTITY=stable
export "$build_env=$key"

if [ "$#" -gt 0 ]; then
  "$@"
else
  NODE_OPTIONS=--max-old-space-size=4096 pnpm run build:release
fi
