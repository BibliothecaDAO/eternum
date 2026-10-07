#!/usr/bin/env bash
# Runs diff-base.sh in a one-commit shallow clone, as the scope job's checkout leaves it. A pull request whose base moved
# on after the branch was cut measures from the branch point, so the base's later changes are not counted as its own.
# A stream branch whose last push touched only TypeScript still measures from its landing base, so the Cairo commit
# pushed before it stays in the diff. A base that cannot be resolved prints nothing.
set -euo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/diff-base.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
git init -q --bare -b next "$work/origin.git"
git -C "$work/origin.git" config uploadpack.allowFilter true
git -C "$work/origin.git" config uploadpack.allowAnySHA1InWant true
git clone -q "$work/origin.git" "$work/author" 2>/dev/null
cd "$work/author"
git config user.email ci@example.test
git config user.name ci
commit() { mkdir -p "$(dirname "$1")"; echo "$2" > "$1"; git add "$1"; git commit -q -m "$1"; }
commit README.md base
branch_point=$(git rev-parse HEAD)
git push -q origin HEAD:next HEAD:native-world-foundation
commit contracts/l3/world.cairo "unlanded Cairo change"
git push -q origin HEAD:stream
commit apps/game/main.ts "later TypeScript-only push"
git push -q origin HEAD:stream
head=$(git rev-parse HEAD)
git checkout -q "$branch_point"
commit .github/workflows/deploy.yml "landed on next after the branch was cut"
git push -q origin HEAD:next
moved_base=$(git rev-parse HEAD)

git clone -q --depth 1 --filter=blob:none --branch stream "file://$work/origin.git" "$work/checkout" 2>/dev/null
cd "$work/checkout"
base_for() { EVENT=$1 PR_BASE_SHA=${2:-} HEAD_SHA=$head bash "$script"; }
changed_from() { git diff --name-only "$1" "$head"; }

fail() { echo "FAIL: $1" >&2; exit 1; }
pull_request_base=$(base_for pull_request "$moved_base")
[ "$pull_request_base" = "$branch_point" ] ||
  fail "a pull request must measure from where it branched, not from its base's tip (got $pull_request_base)"
! changed_from "$pull_request_base" | grep -qx .github/workflows/deploy.yml ||
  fail "a pull request counted a change its base gained after the branch was cut"
stream_base=$(base_for push)
changed_from "$stream_base" | grep -qx contracts/l3/world.cairo ||
  fail "a stream push dropped the earlier Cairo commit (base $stream_base)"
[ -z "$(base_for pull_request 0000000000000000000000000000000000000000)" ] ||
  fail "an unresolvable base must print nothing, so the caller runs every area"
echo "diff-base: pull requests measure from their branch point; stream pushes keep every unlanded commit in scope"
