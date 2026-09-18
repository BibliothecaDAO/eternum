#!/usr/bin/env bash
set -euo pipefail

# Eight native Foundry partitions keep the measured test-runner peak bounded.
for partition in {1..8}; do
  snforge test --max-threads 1 --partition "$partition/8"
done
