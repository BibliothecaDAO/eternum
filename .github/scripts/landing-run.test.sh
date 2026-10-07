#!/usr/bin/env bash
# A commit whose only green validation run was scoped (a pull request, or a push to a branch other than next) is
# refused; the same commit with a green landing run on next is accepted. A commit whose run on next was cancelled by a
# newer merge is refused with that reason and the run to re-run, never with a bare "no green run".
set -euo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/landing-run.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
# A gh that answers `run list --json` from RUNS, one run per line as "<event> <branch> <conclusion> <id>", applying the
# event and branch filters it is given.
cat > "$work/gh" <<'GH'
#!/usr/bin/env bash
event="" branch=""
while [ $# -gt 0 ]; do
  case $1 in --event) event=$2; shift ;; --branch) branch=$2; shift ;; esac
  shift
done
runs=()
while read -r run_event run_branch conclusion id; do
  [ -n "$run_event" ] || continue
  { [ -z "$event" ] || [ "$event" = "$run_event" ]; } && { [ -z "$branch" ] || [ "$branch" = "$run_branch" ]; } &&
    runs+=("{\"databaseId\": $id, \"conclusion\": \"$conclusion\"}")
done <<< "$RUNS"
(IFS=,; echo "[${runs[*]}]")
GH
chmod +x "$work/gh"
check() { RUNS=$1 REPO=owner/repo SHA=abc PATH="$work:$PATH" bash "$script" > "$work/out" 2>&1; }

fail() { echo "FAIL: $1" >&2; exit 1; }
! check "pull_request feature success 1" || fail "a pull request run must not validate a publish"
! check "push native-world-foundation success 2" || fail "a run on the retired integration branch must not validate"
check "push next success 3" || fail "a green run on next must validate a publish"
! check "push next cancelled 42" || fail "a cancelled run on next must not validate a publish"
{ grep -q "cancelled" "$work/out" && grep -q "gh run rerun 42" "$work/out"; } ||
  fail "a commit whose run on next was superseded must say so and name the run to re-run: $(cat "$work/out")"
echo "landing-run: only a landing validation run validates a publish, and a superseded one says how to get one"
