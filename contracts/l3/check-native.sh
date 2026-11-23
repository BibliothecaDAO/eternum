#!/usr/bin/env bash
# The native landing gate, or one named stage of it. Heavy runs belong to the build service.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."
world=contracts/l3/world-native
verifier=contracts/l3/vrf-verifier
account=contracts/l3/player-account

prelude() {
  python3 "$world/toolchain/snforge.py" resolve > /dev/null
  node --test contracts/l3/check-native-plan.test.mjs
  python3 -m unittest discover -s "$world/toolchain" -p test_snforge.py
  bash contracts/l2/ledger/check.sh
  (cd "$account" && "${LEDGER_SCARB:-scarb}" build)
  bun test "$account/check-class-hash.test.ts"
  bun "$account/check-class-hash.ts"
}

verify_randomness() {
  export ASDF_SCARB_VERSION=2.17.0
  local runner
  runner=$(python3 "$world/toolchain/snforge.py" resolve)
  (cd "$verifier" && scarb build)
  node --test contracts/utils/check-class-sizes.test.mjs
  node contracts/utils/check-class-sizes.mjs "$verifier/target/dev" realms_vrf_verifier Verifier
  bun "$verifier/scripts/pin-class.ts" --check
  (cd "$verifier" && "$runner" test)
}

build_world() {
  (cd "$world" && scarb build)
}

build_blitz() {
  (cd "$world" && scarb --target-dir target/blitz build --features blitz)
}

assert_families_share_games() {
  cmp "$world/target/dev/world_native_Games.contract_class.json" \
    "$world/target/blitz/dev/world_native_Games.contract_class.json" ||
    { echo "The Blitz build changes the Games class: both families run under one Games" >&2; exit 1; }
}

check_sizes() {
  build_world
  node "$world/scripts/check-class-sizes.mjs"
  build_blitz
  node "$world/scripts/check-class-sizes.mjs" target/blitz/dev
  assert_families_share_games
}

check_world() {
  node "$world/scripts/check-wire-ids.mjs"
  node "$world/scripts/check-discovery-vectors.mjs"
  node "$world/scripts/check-blitz-marks.mjs"
  build_world
  node --test "$world/scripts/check-class-sizes.test.mjs" "$world/scripts/check-fact-wire.test.mjs" "$world/scripts/event-layouts.test.mjs" "$world/scripts/taxonomy.test.mjs" "$world/scripts/rule-constants.test.mjs" "$world/scripts/wire-types.test.mjs" "$world/scripts/wire-ids.test.mjs" "$world/scripts/check-discovery-vectors.test.mjs" "$world/scripts/check-blitz-marks.test.mjs" "$world/scripts/ledger-result-vector.test.mjs"
  node "$world/scripts/check-class-sizes.mjs"
  bun "$world/scripts/pin-games-class.ts"
  bun test "$world/scripts/pin-release-classes.test.ts"
  bun "$world/scripts/pin-release-classes.ts"
}

check_events() {
  (cd "$world/tests" && RAYON_NUM_THREADS=1 scarb build --test --package 'world_tests_*')
  node "$world/scripts/check-fact-wire.mjs"
}

check_drift() {
  build_world
  build_blitz
  pnpm run schema:native
  pnpm run fixtures:native
  (cd "$world" && scarb fmt)
  (cd "$world/tests" && scarb fmt)
  (cd "$world/tests/blitz" && scarb fmt)
  git diff --exit-code -- "$world/schema" "$world/src" "$world/storage" "$world/tests"
}

test_package() {
  local package=$1
  if [[ "$package" == discovery ]]; then
    node "$world/scripts/check-discovery-vectors.mjs"
  fi
  (cd "$world/tests" && RAYON_NUM_THREADS=1 scarb build --test --package "world_tests_$package*")
  if [[ "$package" == discovery ]]; then
    bash contracts/l3/test-native.sh --package world_tests_discovery
    bash contracts/l3/test-native.sh --package world_tests_discovery_roots
  else
    bash contracts/l3/test-native.sh --package "world_tests_$package*"
  fi
}

test_blitz() {
  (cd "$world/tests/blitz" && RAYON_NUM_THREADS=1 scarb build --test --workspace)
  NATIVE_TEST_WORKSPACE=tests/blitz bash contracts/l3/test-native.sh --package "world_tests_blitz_*"
}

case "${1:-all}" in
  all) bash contracts/l3/check-native-plan.sh ;;
  prelude) prelude ;;
  vrf) verify_randomness ;;
  build) build_world ;;
  build-blitz) build_blitz ;;
  sizes) check_sizes ;;
  world) check_world ;;
  events) check_events ;;
  drift) check_drift ;;
  test-capture|test-combat|test-discovery|test-economy|test-lifecycle|test-registration|test-resources|test-world)
    test_package "${1#test-}" ;;
  test-blitz) test_blitz ;;
  *) echo "Unknown native gate stage: $1" >&2; exit 2 ;;
esac
