#!/usr/bin/env bash
# Runs diff-base.sh in a one-commit shallow clone, as the scope job's checkout leaves it. A pull request whose base
# moved on after the branch was cut measures from the branch point, so the base's later changes are not counted as its
# own, and every commit on the branch stays in the diff. A base that cannot be resolved prints nothing.
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
git push -q origin HEAD:next
commit contracts/l3/world.cairo "the branch's earlier Cairo commit"
commit apps/game/main.ts "the branch's later TypeScript-only commit"
git push -q origin HEAD:feature
head=$(git rev-parse HEAD)
git checkout -q "$branch_point"
commit .github/workflows/deploy.yml "landed on next after the branch was cut"
git push -q origin HEAD:next
moved_base=$(git rev-parse HEAD)

git clone -q --depth 1 --filter=blob:none --branch feature "file://$work/origin.git" "$work/checkout" 2>/dev/null
cd "$work/checkout"
base_for() { PR_BASE_SHA=$1 HEAD_SHA=$head bash "$script"; }
changed_from() { git diff --name-only "$1" "$head"; }

fail() { echo "FAIL: $1" >&2; exit 1; }
base=$(base_for "$moved_base")
[ "$base" = "$branch_point" ] ||
  fail "a pull request must measure from where it branched, not from its base's tip (got $base)"
! changed_from "$base" | grep -qx .github/workflows/deploy.yml ||
  fail "a pull request counted a change its base gained after the branch was cut"
changed_from "$base" | grep -qx contracts/l3/world.cairo || fail "a pull request dropped its own earlier commit"
[ -z "$(base_for 0000000000000000000000000000000000000000)" ] ||
  fail "an unresolvable base must print nothing, so the caller runs every area"
echo "diff-base: a pull request measures from its branch point and keeps every commit it carries"
