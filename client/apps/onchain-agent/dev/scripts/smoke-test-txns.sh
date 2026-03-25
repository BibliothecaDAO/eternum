#!/bin/bash
# Smoke test — transaction commands (makes on-chain state changes).
# Usage: CHAIN=slot WORLD_NAME=bltz-froth-584 ./dev/scripts/smoke-test-txns.sh
#
# Uses known realm entity IDs from the world. Adjust if your world differs.

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

# Known realm entity IDs (from map find own_structure)
REALM_A=169   # at (0,-8)
REALM_B=174   # at (2,-11)
REALM_C=179   # at (-1,-11)

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
echo "Running transaction smoke tests → $OUT"
echo ""

# ── Create army ──────────────────────────────────────────────────────
# Should succeed — realm has 0/1 armies and troops in storage
run "create-army at realm A" true \
  $AXIS create-army $REALM_A

# Find army ID via map query
ARMY_ID=$($AXIS map find own_army --json 2>/dev/null | grep -o '"entityId":[0-9]*' | head -1 | grep -o '[0-9]*$')
echo "  (army ID: ${ARMY_ID:-none found})"

# ── Simulate attack (read-only, but tests the path) ─────────────────
# Should fail — no enemy adjacent
run "simulate-attack (no target)" false \
  $AXIS simulate-attack ${ARMY_ID:-99999} 0 -7

# ── Move army ────────────────────────────────────────────────────────
if [ -n "$ARMY_ID" ]; then
  run "move-army one hex" true \
    $AXIS move-army $ARMY_ID 0 -7
else
  echo "  SKIP  move-army (no army)"
fi

# ── Reinforce army ───────────────────────────────────────────────────
# Should fail — army moved away from home structure
if [ -n "$ARMY_ID" ]; then
  run "reinforce-army (not adjacent)" false \
    $AXIS reinforce-army $ARMY_ID 100
else
  echo "  SKIP  reinforce-army (no army)"
fi

# ── Attack (expected failure — nothing to attack) ────────────────────
if [ -n "$ARMY_ID" ]; then
  run "attack (no target)" false \
    $AXIS attack $ARMY_ID 0 -6
else
  echo "  SKIP  attack (no army)"
fi

# ── Open chest (expected failure — no chest) ─────────────────────────
if [ -n "$ARMY_ID" ]; then
  run "open-chest (no chest)" false \
    $AXIS open-chest $ARMY_ID 1 -7
else
  echo "  SKIP  open-chest (no army)"
fi

# ── Send resources ───────────────────────────────────────────────────
# Send 10 wood (resource 3) from realm A to realm B
run "send-resources A→B" true \
  $AXIS send-resources $REALM_A $REALM_B --resources '3:10'

# ── Guard from storage ───────────────────────────────────────────────
# May fail if realm has no troops in storage (create-army consumed them)
run "guard-from-storage at realm B" true \
  $AXIS guard-from-storage $REALM_B 0 Crossbowman 1 100

# ── Apply relic (expected failure — no relic) ────────────────────────
run "apply-relic (no relic)" false \
  $AXIS apply-relic $REALM_A 99 0

# ── Summary ──────────────────────────────────────────────────────────
echo ""
echo "Results: $pass passed, $fail failed"
echo "Details in $OUT"
