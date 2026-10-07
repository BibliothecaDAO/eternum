#!/usr/bin/env bash
# The native suite's partitions: CI starts one job per partition the script names, and each job runs exactly its own
# partition under the same one-thread bound; with no argument (scarb test, conformance) the script runs all of them.
set -euo pipefail
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)/contracts/l3/test-native.sh
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
# A snforge that records each invocation's arguments instead of running tests.
cat > "$work/snforge" <<'SNFORGE'
#!/usr/bin/env bash
echo "$*" >> "$CALLS"
SNFORGE
chmod +x "$work/snforge"
runs() {
  : > "$work/calls"
  CALLS="$work/calls" PATH="$work:$PATH" bash "$script" "$@" > /dev/null
  cat "$work/calls"
}

fail() { echo "FAIL: $1" >&2; exit 1; }
partitions=$(bash "$script" --partitions)
[ "$partitions" = "1 2 3 4 5 6 7 8" ] || fail "the script must name its eight partitions (got '$partitions')"
[ "$(runs 3)" = "test --max-threads 1 --partition 3/8" ] || fail "a partition job must run only its own partition"
expected=$(for partition in $partitions; do echo "test --max-threads 1 --partition $partition/8"; done)
[ "$(runs)" = "$expected" ] || fail "with no argument the script must run every partition in turn"
echo "test-native: each partition runs alone in CI, and all of them run in turn without an argument"
