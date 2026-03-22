#!/bin/bash
# Smoke test — map query commands.
# Usage: CHAIN=slot WORLD_NAME=bltz-froth-584 ./dev/scripts/smoke-test-map.sh

set -uo pipefail

AXIS="./dist/axis"
OUT="${1:-smoke-test-results.txt}"

if [ ! -f "$AXIS" ]; then
  echo "Binary not found at $AXIS — run 'bun run dev/scripts/build.ts' first."
  exit 1
fi

# Load .env from dist directory if available
ENV_FILE="$(dirname "$AXIS")/.env"
if [ -f "$ENV_FILE" ] && [ -z "${CHAIN:-}" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

if [ -z "${CHAIN:-}" ] || [ -z "${WORLD_NAME:-}" ]; then
  echo "CHAIN and WORLD_NAME must be set (via env vars or .env in dist/)."
  exit 1
fi

# Known positions from map find own_structure
REALM_X=0
REALM_Y=-8
REALM_ID=169

pass=0
fail=0

run() {
  local label="$1"
  local expect_success="${2:-true}"
  shift 2
  echo "=== $label ===" >> "$OUT"
  echo "\$ $*" >> "$OUT"

  output=$("$@" --json 2>/dev/null)
  exit_code=$?
  echo "$output" >> "$OUT"
  echo "" >> "$OUT"

  if [ "$expect_success" = "true" ] && [ $exit_code -eq 0 ]; then
    echo "  PASS  $label"
    ((pass++))
  elif [ "$expect_success" = "false" ] && [ $exit_code -ne 0 ]; then
    echo "  PASS  $label (expected failure)"
    ((pass++))
  else
    echo "  FAIL  $label (exit=$exit_code, expected_success=$expect_success)"
    ((fail++))
  fi
}

> "$OUT"
echo "Running map smoke tests → $OUT"
echo ""

# ── briefing ─────────────────────────────────────────────────────────
run "map briefing" true \
  $AXIS map briefing

# ── tile-info (known realm position) ─────────────────────────────────
run "map tile-info (realm at $REALM_X,$REALM_Y)" true \
  $AXIS map tile-info $REALM_X $REALM_Y

# ── tile-info (empty tile) ───────────────────────────────────────────
run "map tile-info (empty tile 5,5)" true \
  $AXIS map tile-info 5 5

# ── nearby (around realm) ────────────────────────────────────────────
run "map nearby (realm, radius 3)" true \
  $AXIS map nearby $REALM_X $REALM_Y --radius 3

# ── nearby (default radius) ──────────────────────────────────────────
run "map nearby (realm, default radius)" true \
  $AXIS map nearby $REALM_X $REALM_Y

# ── entity-info (known realm) ────────────────────────────────────────
run "map entity-info (realm $REALM_ID)" true \
  $AXIS map entity-info $REALM_ID

# ── entity-info (nonexistent) ────────────────────────────────────────
run "map entity-info (nonexistent 99999)" false \
  $AXIS map entity-info 99999

# ── find (all 8 types) ──────────────────────────────────────────────
for type in own_army own_structure enemy_army enemy_structure chest hyperstructure mine village; do
  run "map find $type" true \
    $AXIS map find $type
done

# ── find with ref position ───────────────────────────────────────────
run "map find hyperstructure (sorted from realm)" true \
  $AXIS map find hyperstructure --ref-x $REALM_X --ref-y $REALM_Y

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "Results: $pass passed, $fail failed"
echo "Details in $OUT"
