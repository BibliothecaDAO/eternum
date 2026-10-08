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

## Fast setup

The old loop submitted eight homes, ran the SDK's automatic fee simulation, waited for that transaction's confirmed
block, then read the counter and began the next eight. With 500 batches for both arms, block-close waits and repeated
simulation dominated preparation. Setup now keeps at most 16 acknowledged transactions in flight (`--window 16`, range
1..32), signs consecutive explicit nonces from one initial pre-confirmed nonce read, supplies the existing 1.2e9 work
bound, and replenishes the window on successful pre-confirmed receipts. Eight homes per transaction is unchanged: ops
measured one such batch at 674,109,760 gas. This removes per-batch fee estimation, nonce reads and counter reads. It
changes no home recipe, grants, traits, id order or allocator setting. Creation timestamps still follow block time.

One host account remains the sender: the host's owner-only preparation and per-game counter already order these writes.
Adding senders would require changing that authority boundary and would not remove the shared allocation dependency. The
first trial should measure the removed waits before adding that mechanism. The target is both 2,000-home arms in a few
minutes; this is a target, not a claimed box result. Per-arm `provisioningMs`, `verificationMs` and total `setupMs` make
the next result assessable.

After all receipts, setup verifies the exact nonce advance, each game's counter at 2001, every home owner and canonical
realm metadata/resources, level/start flags, untouched research and army membership, every grant balance using the
native castle cap, and the actor's X/Y allocator setting. Two read-only host gates avoid copying Cairo's packed storage
layout into the driver. A rejection, revert, timeout, missing home or state mismatch exits nonzero and publishes no new
fixture. In-flight submissions are observed before that failure is returned; it never fills a nonce gap with a changed
transaction. Only a new Games artifact is required; Troops, Map and Structures are unchanged.

### One setup for CreateExplorer then Explore

YES for the host that has Explore: CreateExplorer leaves its army on the home ring, with the next tile still unrevealed.
Explore in the spawn direction uses that exact army and the genuine first-discovery path. Convert only an entirely
successful CreateExplorer wave, regardless of whether it met the latency bar. `game-explore.ts` checks the result's
chain/contract/game/arm, reads each army id from the chain, and verifies that all armies still match their actor, home,
size and spawn position, with an untouched destination. The new host uses a read-only check; the earlier Explore host
uses private signed simulations. Both retain account validation. Private simulations use `SKIP_FEE_CHARGE`, matching the
trial's `--no-charge-fee`; they consume no nonce or game state.

NO for the original 2d9 CreateExplorer-only host: it has no Explore entrypoint and cannot serve that measurement.

Reset that game's day zero immediately before each measured wave as below. All creations must have stayed on their spawn
day's map; an expired/moved army or used destination rejects conversion. This is a first-reveal comparison; it cannot
recycle an already explored fixture for another first-reveal repetition. Each repetition still needs fresh homes, but it
needs one setup for the pair, not two. Stop/reap the temporary proxy between commands; retain the existing read-only
node watcher and collector, with no other timed wave or provisioning running.

```sh
set -euo pipefail
# Use a fresh REP value/directory for each pair or node-settings candidate.
REP=r2
bun deploy/athanor/spikes/node-first/game-setup.ts \
  --dir "$TRIAL/data" --manifest "$TRIAL/data/native-world.json" \
  --fixture "$TRIAL/data/node-first-private.json" \
  --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2" \
  --preset 101 --amount 1000 --window 16
# Do not use --prepare-explore here: the measured CreateExplorer wave supplies the armies.
NODE_PID=$(python3 deploy/athanor/spikes/node-first/node-pid.py "$NODE_CONTAINER")
NODE_IMAGE=$(sudo -n docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")
for ARM in X Y; do
  CREATE_FIXTURE="$TRIAL/data/node-first-game-$ARM.json"
  EXPLORE_FIXTURE="$TRIAL/data/node-first-pair-$REP-explore-$ARM.json"
  for COMMAND in create explore; do
    if [ "$COMMAND" = create ]; then
      FIXTURE="$CREATE_FIXTURE"
    else
      # The fresh Create wave left day-zero armies; only this unmeasured clock reset runs here.
      bun deploy/athanor/spikes/node-first/game-start.ts \
        --dir "$TRIAL/data" --fixture "$CREATE_FIXTURE" \
        --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2"
      CREATE_RESULT=$(rg --files "$TRIAL/data/pair-$REP-create-$ARM" -g '*.json')
      bun deploy/athanor/spikes/node-first/game-explore.ts \
        --fixture "$CREATE_FIXTURE" --result "$CREATE_RESULT" --out "$EXPLORE_FIXTURE" \
        --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2"
      FIXTURE="$EXPLORE_FIXTURE"
    fi
    bun deploy/athanor/spikes/node-first/game-start.ts \
      --dir "$TRIAL/data" --fixture "$FIXTURE" \
      --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2"
    bun deploy/athanor/spikes/node-first/proxy.ts \
      --fixture "$FIXTURE" --upstream "http://127.0.0.1:$BASE" --port "$((BASE+8))" \
      --events "$TRIAL/data/pair-$REP-$COMMAND-$ARM-proxy.jsonl" \
      > "$TRIAL/data/pair-$REP-$COMMAND-$ARM-proxy.log" 2>&1 &
    TIER2_PROXY_PID=$!
    trap 'kill "$TIER2_PROXY_PID" 2>/dev/null || true' EXIT
    sleep 1
    bun deploy/athanor/spikes/node-first/run.ts \
      --fixture "$FIXTURE" --rpc-url "http://127.0.0.1:$((BASE+8))/rpc/v0_10_2" \
      --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
      --out "$TRIAL/data/pair-$REP-$COMMAND-$ARM" --arms "$ARM" --workers 8 \
      --timeout-ms 600000 --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
      --node-log "$TRIAL/data/node-first-node.log" \
      --node-metrics "$TRIAL/data/metrics/metrics.jsonl"
    kill "$TIER2_PROXY_PID"
    wait "$TIER2_PROXY_PID"
    trap - EXIT
  done
done
```

For an already completed CreateExplorer wave on the earlier Explore-capable host, the same conversion command applies
with its actual fixture/result paths; no new setup or army provisioning is required. The Create-only host fails loudly.
A 2,000-action result with failed/reverted/missing creations also fails conversion rather than measuring a smaller wave.

## Settle

READ: shipped players send `SettleSeason` through the gateway's recorded Games entry. Routing chooses SettlementLogic,
which reserves their entry and a canonical realm, then calls the real StructuresLogic realm/economy provisioner. For
preset101 it does **not** use the spiral/location pool: the persistent reference is `off_map_realm_reference(realm_id)`,
and the day's region is derived from that realm id and spacing. The active shared allocation state is
`settlements.progress[game].realm_count`, `realms.slots/reverse_indices` (the shrinking realm pool, including its common
tail), and `games.next_entity[game]`. Registry/release/preset reads are immutable during the wave. Actor entry,
realm/economy and coordinate facts are private to each chosen realm; no LORDS budget or season-point total is written.
Non-Frontier settling also uses the placement pool/cursor and occupied-site checks; that branch is outside this
preset101 measurement. The full read-before-build report is in the external handoff's Settle read section.

The new standalone SettleGames host has zero homes at preparation. It retains native account validation and calls the
complete real SettlementLogic season entry directly with caller=actor, nonzero name, `selected_realm=None`, real
preset101, real canonical traits, recipe/starting resources and producer. No development selected-realm bypass or
artificial million-resource grant runs in this action. This is an opening with main play begun: realm settlement also
materialises the home ring. Root shape is fixed `Poseidon(123456789,actor)` followed by the shipped game-root
derivation.

X runs the ordinary realm draw, pool reserve, global progress increment and shared entity allocator. It includes one
spike seat lookup returning None; otherwise the season algorithm and economy path are the same. Y draws and reserves a
unique canonical realm for each actor **before** the burst, through the actual shrinking-pool/random-range algorithm, in
fixture actor order. It binds that seat and namespace to the actor. During Y's settle, selection/pool mutation and
aggregate progress are skipped; the real realm/economy provisioner runs normally. The first home id is
`(canonical_realm_id << 16) | 1`, with later ids in that home namespace. Catalogue ids are at most8000, so this bounded
spike fits u32. No actor slot is shared with another actor.

READ: design.html section(d) supplies no seat-assignment rule and described settlement as rare/admin, retaining its
global counter. The requested arm is a spike assumption, not an approved design: real canonical-realm reservation is
moved to registration so no actor may choose or overwrite a seat during the wave. Setup reports registration time. It
resets the temporary reservation count to zero through the canonical SettlementProgress fact before publishing the
zero-home fixtures. Y's aggregate progress stays zero after play; chain verification folds all actor homes. A production
choice would need authoritative progress/count derivation and a decision about the fairness/timing of seat assignment.
The existing CreateExplorer/Explore hosts are unchanged; this host and the changed SettlementLogic are separate
artifacts.

Prepare once while no timed wave is active; the existing accounts and trial services are reused. Setup loads all8000
canonical traits, registers the real preset, creates X/Y games, reserves only Y's seats, and checks every actor has no
home, with both entity counters1 and both realm counts0. Fresh repetitions require fresh setup. Any partial preparation
or duplicate seat fails before fixture publication.

```sh
set -euo pipefail
REP=settle-r1
bun deploy/athanor/spikes/node-first/game-setup.ts \
  --dir "$TRIAL/data" --manifest "$TRIAL/data/native-world.json" \
  --fixture "$TRIAL/data/node-first-private.json" \
  --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2" \
  --preset 101 --action settle --window 16

NODE_PID=$(python3 deploy/athanor/spikes/node-first/node-pid.py "$NODE_CONTAINER")
NODE_IMAGE=$(sudo -n docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")
for ARM in X Y; do
  FIXTURE="$TRIAL/data/node-first-settle-$ARM.json"
  bun deploy/athanor/spikes/node-first/game-start.ts \
    --dir "$TRIAL/data" --fixture "$FIXTURE" \
    --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2"
  bun deploy/athanor/spikes/node-first/proxy.ts \
    --fixture "$FIXTURE" --upstream "http://127.0.0.1:$BASE" --port "$((BASE+8))" \
    --events "$TRIAL/data/$REP-$ARM-proxy.jsonl" \
    > "$TRIAL/data/$REP-$ARM-proxy.log" 2>&1 &
  TIER2_PROXY_PID=$!
  trap 'kill "$TIER2_PROXY_PID" 2>/dev/null || true' EXIT
  sleep 1
  bun deploy/athanor/spikes/node-first/run.ts \
    --fixture "$FIXTURE" --rpc-url "http://127.0.0.1:$((BASE+8))/rpc/v0_10_2" \
    --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
    --out "$TRIAL/data/$REP-results" --arms "$ARM" --workers 8 --timeout-ms 600000 \
    --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
    --node-log "$TRIAL/data/node-first-node.log" \
    --node-metrics "$TRIAL/data/metrics/metrics.jsonl"
  kill "$TIER2_PROXY_PID"
  wait "$TIER2_PROXY_PID"
  trap - EXIT
done
```

Keep the existing read-only watcher/collector and stop any previous temporary proxy at BASE+8 before this loop. The
runner checks zero homes again, warms with private simulation only (`SKIP_FEE_CHARGE`, validation retained), then
presigns/releases all2000 actual player transactions. Spread>=100ms invalidates the wave. It never commits a warmup
home.

After the final receipt, the visibility/CPU timers stop. `settlement` reads all2000 native home observations from chain
and requires distinct ids, owners, canonical realms, persistent references and day sites; matching actor ownership;
initial troop grant, knowledge/resource state and labor producer; X aggregate realm count2000/counter2001; Y aggregate
count0/counter1 and ids in their assigned namespaces. Incomplete or mismatched census invalidates the result; the census
and public per-home observations remain in the JSON for review.

`settleCloseFootprint` uses pure-wave `close_block_complete` records, including the final partial block after
visibility. After the normal collector flush it waits at most60seconds outside the measured window for complete close
coverage. It reports events, state_diff_len, nonce updates, storage-entry count after subtracting nonces, bouncer data
units and their per-settle averages, plus every block's fill. These are block-diff/close averages, including small block
overhead, not a storage-syscall trace. Missing final coverage or other transactions makes per-settle figures null and
prevents a green complete result. Preserve the raw logs, image/flags and metrics; do not assume that the40,000 cap fills
at the same number of settles as the earlier571-army blocks. Exact settle footprint and latency are for ops to measure.
