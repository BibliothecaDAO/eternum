#!/usr/bin/env bash
# A commit whose only green validation run was scoped (a stream-branch push) is refused; the same commit with a green
# landing run on the integration branch is accepted.
set -euo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/landing-run.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
# A gh that answers `run list` from RUNS, one green run per line as "<event> <branch>", applying the filters it is given.
cat > "$work/gh" <<'GH'
#!/usr/bin/env bash
event="" branch=""
while [ $# -gt 0 ]; do
  case $1 in --event) event=$2; shift ;; --branch) branch=$2; shift ;; esac
  shift
done
count=0
while read -r run_event run_branch; do
  [ -n "$run_event" ] || continue
  { [ -z "$event" ] || [ "$event" = "$run_event" ]; } && { [ -z "$branch" ] || [ "$branch" = "$run_branch" ]; } &&
    count=$((count + 1))
done <<< "$RUNS"
echo "$count"
GH
chmod +x "$work/gh"
check() { RUNS=$1 REPO=owner/repo SHA=abc PATH="$work:$PATH" bash "$script" > /dev/null 2>&1; }

fail() { echo "FAIL: $1" >&2; exit 1; }
! check "push native-foo" || fail "a scoped stream-branch run must not validate a publish"
! check "pull_request native-foo" || fail "a pull request run must not validate a publish"
check "push native-world-foundation" || fail "a green integration run must validate a publish"
check "push next" || fail "a green run on next must validate a publish"
echo "landing-run: only a landing validation run validates a publish"
