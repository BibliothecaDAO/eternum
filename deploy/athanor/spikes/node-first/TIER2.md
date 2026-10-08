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
slots keyed by `(game, actor)` for this one-home-per-actor fixture. Home ids 1..2000 and 65535 ids/home fit u32 here.
This is a bounded spike choice, not a production namespace design. Both variants include a caller-keyed last-id write
for observation. TroopsLogic, MapLogic and StructuresLogic are rebuilt; the other domain classes remain the trial's
shipped classes. Map and Structures use the same allocator for discoveries, as described in the Explore section below.

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

NODE_PID=$(python3 deploy/athanor/spikes/node-first/node-pid.py "$NODE_CONTAINER")
NODE_IMAGE=$(sudo -n docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")
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

## Explore: genuine first-reveal discovery

The new host calls the shipped MovementLogic Explore entrypoint with the caller as actor. MapLogic and StructuresLogic
are now rebuilt, as well as TroopsLogic, so every discovery uses the same X/Y allocator as armies. The new release
replaces those three hashes only. Both Map's shrine/well allocation and Structures' guarded-site allocation use it. The
original trial Games and the already-running CreateExplorer fixture are untouched. Explore setup saves separate
`node-first-explore-X.json` and `node-first-explore-Y.json` files.

First reveals run the actual preset101 discovery, chest affordability, Ruin reservation, structure creation, beasts,
food/stamina payment, supply reward and XP paths. The destination is one step farther in the spawn direction, outside
the seven-tile home ring, inside the actor's own region. No discovery is forced and no LORDS reservation is bypassed.
The test root is fixed, but Poseidon(root, actor) separates actors before the real game-root derivation. Reusing one
identical seed and timestamp for 2,000 actors would produce a correlated draw, rather than the real 1% rate. X and Y
have different game ids, so their exact draws differ; report actual counts for each, not an assumed identical count.

Setup provisions armies through real signed RealmsAccount calls outside the measured window. A preparation-only
entrypoint uses the game's start timestamp so a slow setup cannot provision armies on several different day maps. Then
the host resets that game's start to current time. The measured Explore still uses actual block time. Reset the other
arm immediately before its run too; this prevents X's duration from expiring Y's prepared day-zero armies. If the
measured wave itself crosses a day boundary, preserve the failures and mark the discovery comparison invalid; never
present expired-army reverts as a valid throughput result. The result captures before/after day and budget facts.

Ops commands on the same fresh trial, with the existing 2,000-account tier1 fixture:

```sh
bun deploy/athanor/spikes/node-first/game-setup.ts \
  --dir "$TRIAL/data" --manifest "$TRIAL/data/native-world.json" \
  --fixture "$TRIAL/data/node-first-private.json" \
  --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2" \
  --preset 101 --amount 1000 --prepare-explore true

NODE_PID=$(python3 deploy/athanor/spikes/node-first/node-pid.py "$NODE_CONTAINER")
NODE_IMAGE=$(sudo -n docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")
for ARM in X Y; do
  bun deploy/athanor/spikes/node-first/game-start.ts \
    --dir "$TRIAL/data" --fixture "$TRIAL/data/node-first-explore-$ARM.json" \
    --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2"
  bun deploy/athanor/spikes/node-first/proxy.ts \
    --fixture "$TRIAL/data/node-first-explore-$ARM.json" \
    --upstream "http://127.0.0.1:$BASE" --port "$((BASE+8))" \
    --events "$TRIAL/data/tier2-explore-$ARM-proxy.jsonl" \
    > "$TRIAL/data/tier2-explore-$ARM-proxy.log" 2>&1 &
  TIER2_PROXY_PID=$!
  sleep 1
  bun deploy/athanor/spikes/node-first/run.ts \
    --fixture "$TRIAL/data/node-first-explore-$ARM.json" \
    --rpc-url "http://127.0.0.1:$((BASE+8))/rpc/v0_10_2" \
    --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
    --out "$TRIAL/data/tier2-explore-results" --arms "$ARM" --workers 8 \
    --timeout-ms 600000 --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
    --node-log "$TRIAL/data/node-first-node.log" \
    --node-metrics "$TRIAL/data/metrics/metrics.jsonl"
  kill "$TIER2_PROXY_PID"
done
```

Stop/reap any previous temporary proxy occupying BASE+8 before starting this one. Keep the existing log watcher and
metrics collector; run no overlapping experiments. One fixture supports one first-reveal wave only. A repeat requires
fresh setup. The driver reports receipt-observed `discovery.reveals`, `ruins`, `budgetWrites`, `structuresAllocated`,
`ruinRate`, per-action counts and before/after facts. A valid complete run must show 2,000 first reveals, one
budget-write fact per Ruin, no day crossing, X's counter increasing by the number of new structures and Y's counter
unchanged. Shrine/Well research is locked in this fresh fixture, so those tile-only allocations cannot occur.

### Shared writes left in Y: the bucket decision

READ: `config/source/frontier/native.ts:100` gives ruins 100 basis points. Fresh homes have no Scouting or shrine/well
research; empty-reveal counts start at zero. With an affordable chest, each first reveal therefore has a nominal 1% Ruin
chance: GUESS expectation about 20 of 2,000, not a measured result. Budget exhaustion can reduce that rate. The actual
receipt count is the number ops must report.

READ: `logic/map.cairo:385-399` offers a chest before the draw unless that home/day already found a Ruin. Here all 2,000
first reveals read the same `relics.lords_budget[game]` record, even when they discover nothing or another kind. A Ruin
calls `lords_budget::reserve` (`logic/lords_budget.cairo:42-47`): it updates that shared record's `open` and `spent`,
initializing/rolling day, price, ceiling and estimate when necessary. `write` at line186 serializes the whole budget
record and emits one LordsBudget fact. This is reservation, not payout: `pool_left` is reduced on clearing, not finding.
The rate controls shared budget writes; it does not remove the shared budget reads. GUESS: a Ruin write can invalidate
other actors' speculative reads and cause re-execution; correlate actual abort/attempt counters with this run before
attributing a cost or choosing buckets.

READ: no shared season-points write occurs here. Exploration calls SeasonLogic, but Frontier's exploration award is zero
(`config/source/frontier/base.ts:150`), and `logic/season.cairo:228` returns before reading/writing season totals. The
non-Frontier relic-clock and hyperstructure-count branches are skipped (`logic/movement.cairo:76-116`). No order, head
or transcript exists in this host, and Y's `games.next_entity[game]` stays unchanged. Those are the remaining
per-game-only mutable paths found in the real first-reveal call graph; this spike makes no node write-set claim beyond
what its receipts/counters show.

READ: other discovery writes include `(game,home,day)` empty-reveal and ruin-found markers, `(game,site)` chest,
structure, guard and ExpeditionSite records, `(game,coord)` terrain/occupancy and `(game,entity)` reverse indices. Army
resources, food, progress, slots and allocator count/last-id are actor/home/entity scoped. They can still conflict when
actors share a tile/site/home, but this fixture places one actor in each disjoint realm region. A found chest is stored
under its new site id, not a second per-game budget. No Ruin clearing, LORDS spending/refill or withdrawal occurs in
this wave.
