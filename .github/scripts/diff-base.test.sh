#!/usr/bin/env bash
# A stream branch whose last push touched only TypeScript still measures from its landing base, so the Cairo commit
# pushed before it stays in the diff and its checks run.
set -euo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/diff-base.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
git init -q --bare -b next "$work/origin.git"
git clone -q "$work/origin.git" "$work/repo" 2>/dev/null
cd "$work/repo"
git config user.email ci@example.test
git config user.name ci
commit() { mkdir -p "$(dirname "$1")"; echo "$2" > "$1"; git add "$1"; git commit -q -m "$1"; }
commit README.md base
git push -q origin HEAD:next HEAD:native-world-foundation
commit contracts/l3/world.cairo "unlanded Cairo change"
git push -q origin HEAD:stream
before=$(git rev-parse HEAD)
commit apps/game/main.ts "later TypeScript-only push"
git push -q origin HEAD:stream
head=$(git rev-parse HEAD)
base_for() { EVENT=$1 PR_BASE_SHA=${2:-} HEAD_SHA=$head bash "$script"; }

fail() { echo "FAIL: $1" >&2; exit 1; }
stream_base=$(base_for push)
git diff --name-only "$stream_base" "$head" | grep -qx contracts/l3/world.cairo ||
  fail "a stream push dropped the earlier Cairo commit (base $stream_base)"
[ "$(base_for pull_request "$before")" = "$before" ] || fail "a pull request must measure from its base"
echo "diff-base: stream pushes keep every unlanded commit in scope"
