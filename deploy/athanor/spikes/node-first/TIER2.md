# Tier 2: direct CreateExplorer

Throwaway `spike/node-first` only: no merge, PR or reuse without rewrite. Ops owns all box actions. The existing
trial/accounts are reused; its original Games is untouched.

This deploys a separate, small `Games` host. It contains no recorded execution, SequencingAccount,
order/head/transcript, or actor-intent nonce. The caller is the actor, validated by native RealmsAccount and a class
check. It calls the genuine TroopsLogic CreateExplorer library; payment, expiry, army-slot allocation, terrain,
occupancy, army state, resources and story/fact emission execute normally. Randomness uses fixed root 123456789. Legacy
StoryCursor.order is a constant zero event field, not a sequence or shared storage slot; this is receipt visibility, not
client sync.

X keeps the real per-game entity counter. Y uses `(home_id << 16) | home_count`, with allocator control/count/last-id
slots keyed by `(game, actor)` for this one-home-per- actor fixture. Home ids 1..2000 and 65535 ids/home fit u32 here.
This is a bounded spike choice, not a production namespace design. Both variants include a caller-keyed last-id write
for observation. Other domain classes remain the trial's shipped classes. Only the host and TroopsLogic are rebuilt.
Explore later also needs the Map/Structures classes rebuilt so discoveries use the same allocator.

The setup registers the real preset101, creates fresh X/Y Frontier games, provisions homes through the real settlement
library with canonical realm traits and recipe resources, and starts them after provisioning. Preparation is outside the
burst. The first comparison raises 1000 Knights T1 per actor, one per realm. Change `--amount` if comparing a different
measured army size. Every repetition needs fresh setup: reusing the fixture would create a second army on an occupied
destination.

On the existing fresh trial, from this checkout (environment/BASE/TRIAL/NODE_CONTAINER as in the tier1 handoff;
OPERATOR_TOKEN is not needed because accounts already exist):

```sh
bun deploy/athanor/spikes/node-first/game-setup.ts \
  --dir "$TRIAL/data" --manifest "$TRIAL/data/native-world.json" \
  --fixture "$TRIAL/data/node-first-private.json" \
  --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2" --preset 101 --amount 1000

NODE_PID=$(docker inspect --format '{{.State.Pid}}' "$NODE_CONTAINER")
NODE_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")
# Start/keep the existing read-only node log watcher as in tier1.
for ARM in X Y; do
  bun deploy/athanor/spikes/node-first/proxy.ts \
    --fixture "$TRIAL/data/node-first-game-$ARM.json" \
    --upstream "http://127.0.0.1:$BASE" --port "$((BASE+8))" \
    --events "$TRIAL/data/tier2-$ARM-proxy.jsonl" > "$TRIAL/data/tier2-$ARM-proxy.log" 2>&1 &
  TIER2_PROXY_PID=$!
  sleep 1
  bun deploy/athanor/spikes/node-first/run.ts \
    --fixture "$TRIAL/data/node-first-game-$ARM.json" \
    --rpc-url "http://127.0.0.1:$((BASE+8))/rpc/v0_10_2" \
    --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
    --out "$TRIAL/data/tier2-create-results" --arms "$ARM" --workers 8 \
    --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
    --node-log "$TRIAL/data/node-first-node.log" \
    --node-metrics "$TRIAL/data/metrics/metrics.jsonl"
  kill "$TIER2_PROXY_PID"
done
```

Warmup simulates the real signed call privately, waits for native compilation, then presigns the actual wave at the
unchanged account nonce. Nothing is committed by warmup. All measured invokes use the public spike proxy. No envelope or
signature suffix is attached. The result uses the same clocks/release barrier as tier1, reports effect status and the
counter delta (X +2000, Y unchanged), and marks send spread >=100ms invalid. The expected counter also guards against
accidentally using the wrong library/allocator. Preserve logs, metrics, CPU samples and image/config alongside each
result. The already-tested driver stages remain unchanged for tier1.
