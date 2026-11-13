#!/usr/bin/env bash
# The complete native gate. The service runs these same stages as individual jobs.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
for stage in prelude vrf world events drift test-capture test-combat test-discovery test-economy test-lifecycle test-registration test-resources test-world; do
  bash contracts/l3/check-native.sh "$stage"
done
