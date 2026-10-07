#!/usr/bin/env bash
set -euo pipefail

# Eight native Foundry partitions, each on one runner thread, keep the test-runner peak bounded: one partition alone
# peaked near 8 GB in a local run. With no argument the script runs every partition in turn; a partition number
# (`scarb test 3`) reruns that one alone after a fix.
partitions=8
for partition in ${1:-$(seq 1 "$partitions")}; do
  snforge test --max-threads 1 --partition "$partition/$partitions"
done
