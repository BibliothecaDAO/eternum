#!/usr/bin/env bash
# M0 validation checks against the running spike stack. Read the output — some
# checks print evidence for manual eyeballing rather than pass/fail.
set -uo pipefail

RPC_URL="${RPC_URL:-http://localhost:5050}"
TORII_URL="${TORII_URL:-http://localhost:8080}"
# "WP_REALMS_DEV" as a cairo short string
EXPECTED_CHAIN_ID="0x57505f5245414c4d535f444556"
# contracts/l3/game/src/constants.cairo UNIVERSAL_DEPLOYER_ADDRESS
UDC_ADDRESS="0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf"

rpc() {
  curl -sf -m 5 -X POST -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$1\",\"params\":$2}" "$RPC_URL"
}

pass=0; fail=0
check() { # name, condition
  if [ "$2" = "true" ]; then echo "PASS  $1"; pass=$((pass+1));
  else echo "FAIL  $1"; fail=$((fail+1)); fi
}

echo "== katana =="
CHAIN_ID=$(rpc starknet_chainId "[]" | jq -r '.result // empty')
check "chain id is WP_REALMS_DEV ($CHAIN_ID)" \
  "$([ "$CHAIN_ID" = "$EXPECTED_CHAIN_ID" ] && echo true || echo false)"

UDC_CLASS=$(rpc starknet_getClassHashAt "[\"pre_confirmed\", \"$UDC_ADDRESS\"]" | jq -r '.result // empty')
check "UDC predeployed at canonical address (class $UDC_CLASS)" \
  "$([ -n "$UDC_CLASS" ] && echo true || echo false)"

BLOCK_A=$(rpc starknet_blockNumber "[]" | jq -r '.result')
sleep 35
BLOCK_B=$(rpc starknet_blockNumber "[]" | jq -r '.result')
check "heartbeat mines blocks while idle ($BLOCK_A -> $BLOCK_B)" \
  "$([ "${BLOCK_B:-0}" -gt "${BLOCK_A:-0}" ] 2>/dev/null && echo true || echo false)"

echo
echo "== sidecars (from katana logs; eyeball these) =="
docker logs "$(docker ps -qf name=katana | head -1)" 2>&1 |
  grep -iE "vrf|paymaster" | grep -viE "heartbeat" | tail -15

echo
echo "== torii (skipped unless reachable) =="
if curl -sf -m 3 "$TORII_URL" >/dev/null 2>&1; then
  echo "-- distinct worlds known to torii:"
  curl -sf -G "$TORII_URL/sql" --data-urlencode \
    "query=SELECT DISTINCT world_address FROM models" | jq . || echo "(query failed — check table name against this torii version)"
  echo "-- per-world model counts (expect two rows with equal counts):"
  curl -sf -G "$TORII_URL/sql" --data-urlencode \
    "query=SELECT world_address, COUNT(*) c FROM models GROUP BY world_address" | jq . || true
else
  echo "torii not reachable at $TORII_URL (start it after deploy-worlds.sh)"
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
