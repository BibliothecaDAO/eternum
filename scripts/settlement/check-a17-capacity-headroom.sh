#!/usr/bin/env bash

set -euo pipefail

readonly STEP_LIMIT=20000000
benchmark_log="$(mktemp -t a17-capacity-benchmark.XXXXXX)"
trap 'rm -f "${benchmark_log}"' EXIT

snforge test season_hub_capacity \
  --tracked-resource cairo-steps \
  --detailed-resources | tee "${benchmark_log}"

required_tests=(
  one_atomic_append_accepts_sixteen_parents_and_two_hundred_fifty_six_lot_shares
  mixed_game_and_global_seal_promotes_sixteen_parents_and_two_hundred_fifty_six_rows
  existing_full_batch_seals_before_a_valid_next_source_is_appended
  thirty_two_world_global_factory_finalization_reads_only_staged_commitments
  worst_distribution_seals_fifteen_games_and_one_global_parent_with_full_storage_work
)

enforce_required_benchmark() {
  local test_name="$1"
  local pass_pattern="^\\[PASS\\].*::${test_name} "
  local match_count
  match_count="$(grep -Ec "${pass_pattern}" "${benchmark_log}" || true)"
  if [[ "${match_count}" != "1" ]]; then
    echo "A17 benchmark must pass exactly once: ${test_name} (found ${match_count})" >&2
    exit 1
  fi

  local pass_line
  local line_number
  local step_line
  local measured_steps
  pass_line="$(grep -En "${pass_pattern}" "${benchmark_log}")"
  line_number="${pass_line%%:*}"
  step_line="$(sed -n "$((line_number + 1))p" "${benchmark_log}")"
  if [[ ! "${step_line}" =~ ^[[:space:]]*steps:[[:space:]]+([0-9]+)[[:space:]]*$ ]]; then
    echo "A17 benchmark has no well-formed step measurement: ${test_name}" >&2
    exit 1
  fi
  measured_steps="${BASH_REMATCH[1]}"
  if ((measured_steps > STEP_LIMIT)); then
    echo "A17 Cairo-step ceiling exceeded for ${test_name}: ${measured_steps} > ${STEP_LIMIT}" >&2
    exit 1
  fi
}

for test_name in "${required_tests[@]}"; do
  enforce_required_benchmark "${test_name}"
done

awk -v limit="${STEP_LIMIT}" '
  /^        steps:/ {
    measured += 1
    if ($2 > limit) {
      printf "A17 Cairo-step ceiling exceeded: %d > %d\n", $2, limit > "/dev/stderr"
      failed = 1
    }
  }
  END {
    if (measured == 0) {
      print "A17 benchmark emitted no Cairo-step measurements" > "/dev/stderr"
      exit 1
    }
    exit failed
  }
' "${benchmark_log}"
