#!/usr/bin/env bash
set -euo pipefail

# Eight native Foundry partitions, each on one runner thread, keep the test-runner peak bounded: one partition alone
# peaked near 8 GB in a local run. CI runs each partition as its own job (`test-native.sh 3`, the list from
# `--partitions`); with no argument the script runs every partition in turn.
partitions=8
if [ "${1:-}" = --partitions ]; then
  seq -s ' ' 1 "$partitions"
  exit 0
fi
for partition in ${1:-$(seq 1 "$partitions")}; do
  snforge test --max-threads 1 --partition "$partition/$partitions"
done
