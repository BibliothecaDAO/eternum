# Throwaway node scheduling probe

Branch `spike/node-first` is never merged. Nothing here is reused without a rewrite. Only ops runs this on a **fresh
isolated dev-box trial**, never staging-g or production. The existing RealmsAccount class, guardian and unmodified node
image are unchanged.

X writes a game counter and head; Y writes only caller-keyed slots. Both run the same configurable storage/hash loop.
The first comparison is `32:256` (writes:hashes per write). This is a candidate work size, **not a measured 7.4 ms
calibration**. Next use `8:128`, `32:256`, `64:512`, then adjust to bracket the measured CreateExplorer cost.

The probe's prebuilt Sierra and CASM are in `artifacts/`; no box compiler is needed. The account factory is the existing
harness's `createHarnessAccounts`, including real guardian-approved device keys. Its private fixture is mode 0600 and
must never be printed or committed. Setup signs/declares through the private trial endpoint; the measured wave always
enters the public allowlisted spike proxy.

## First run

After ops creates the fresh trial using its matrix/package, on realms-dev:

```sh
cd /path/to/the/spike/node-first/checkout
set -a
. "$TRIAL/data/harness.env"
set +a
# BASE is this fresh trial's port base; NODE_CONTAINER is its Madara container.
# All paths below belong to the new trial; do not substitute staging-g.
bun deploy/athanor/spikes/node-first/setup.ts \
  --dir "$TRIAL/data" --manifest "$TRIAL/data/native-world.json" \
  --private-rpc "http://127.0.0.1:$BASE/rpc/v0_10_2" \
  --public-rpc "http://127.0.0.1:$((BASE+5))/rpc/v0_10_2" --count 2000

# Fresh probe boundary: only these accounts, one probe call, no declarations or arbitrary writes.
bun deploy/athanor/spikes/node-first/proxy.ts \
  --fixture "$TRIAL/data/node-first-private.json" \
  --upstream "http://127.0.0.1:$BASE" --port "$((BASE+7))" \
  --events "$TRIAL/data/node-first-proxy.jsonl" > "$TRIAL/data/node-first-proxy.log" 2>&1 &
SPIKE_PROXY_PID=$!
docker logs --follow --since 0s "$NODE_CONTAINER" > "$TRIAL/data/node-first-node.log" 2>&1 &
SPIKE_LOG_PID=$!
NODE_PID=$(python3 deploy/athanor/spikes/node-first/node-pid.py "$NODE_CONTAINER")
NODE_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")

bun deploy/athanor/spikes/node-first/run.ts \
  --fixture "$TRIAL/data/node-first-private.json" \
  --rpc-url "http://127.0.0.1:$((BASE+7))/rpc/v0_10_2" \
  --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
  --out "$TRIAL/data/node-first-results" --arms X,Y --work 32:256 --workers 8 \
  --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
  --node-log "$TRIAL/data/node-first-node.log" \
  --node-metrics "$TRIAL/data/metrics/metrics.jsonl" --timeout-ms 600000
kill "$SPIKE_PROXY_PID" "$SPIKE_LOG_PID"
```

The harness factory imports the normal built workspace packages; use the existing prepared runner checkout, or
`flock /tmp/eternum-client.lock pnpm run build:packages` if that checkout does not have them. No native build or suite
is needed on the box. The trial port base must be at least 28000. Its path must contain `spike`/`node-first`. The matrix
owns image/flags/config selection; record them beside the results. The audit's 4096 transaction block capacity is a
**fresh-trial input**, never a settings edit to a running shard; block gas capacity can still constrain the heavier work
sizes.

Each arm warms the probe once, waits 15 seconds (adjust `--warm-ms` if necessary), pre-signs one invoke/account, opens
receipt/head subscriptions and warms every sender connection. Eight senders wait on one shared release barrier. A
spread >=100 ms marks the run invalid; no slow wave is called concurrent. Every pre-confirmed receipt uses the same host
monotonic clock as sends. Reverted/missing receipts never yield a valid last-visible number. The goal verdict uses <5000
ms and the stretch <2000 ms.

Each JSON file contains first send, every send/receipt/status/error, spread, last visibility, p50/p95, known shared
slots, CPU samples, executor batch logs, metric attempt/commit/abort deltas and closed blocks. Per-core node CPU is
derived from thread CPU ticks assigned to their last sampled processor; migration is approximate. Missing upstream
metrics are reported unavailable, never zero. The collector's extra 16-second flush wait is outside reported
visibility/CPU/log windows. Every fresh-shard comparison also commits one full-size COLD burst of the measured action,
records it separately, then measures three WARM bursts. The simulation warm-up is not that committed burst. Rank the
worst warm result, with the warm median as tie-break. Tier 1 measures receipt visibility, not Herald/client rendering.
Save node logs, proxy ingress timings and the node's exact flags/config with it. Questions and build count are in the
inbox log.

Tier 2 waits until ops has run tier 1 once. No Games redesign is implemented here.

For the settings matrix, the runner accepts `node_environment.RUST_LOG` with
`info,mc_block_production::close_pipeline::reply=debug` on every candidate. This records actual executor batch sizes and
durations without changing the upstream image. The environment override reaches the node only; other keys are refused.
The filter costs extra batch log writes, so keep it identical across controls and candidates. This is spike evidence
plumbing, never a production recommendation.

## Warm four-game Blitz gate

`blitz-setup.ts` prepares four actual preset-2 rosters of 24 distinct accounts through the shipped settlement library.
It uses the throwaway `BlitzGames` host and its supplied `artifacts-blitz` files. Every measured call enters the genuine
construction library directly from a native Realms account. The flow alternates building and demolishing a category-1
building on each player's own home at inner cell `(11, 10)`. Fixture resources are granted before measurement. This
repeatable construction workload compares small-game publication under the same settings; it does not reproduce a mixed
gameplay session. Repeated movement cannot sustain 20.3 actions/s on these rosters: the shipped tick is 60 seconds and
travel costs stamina.

The flow records and discards a full 96-action cold wave for each action, confirms preparation, then presigns all steady
work. It offers 20.3 actions/s independently of preceding receipts and reports scheduling delay, refusals and every
receipt. Use a fresh directory with the trial's private host-key file, and a separate 96-account fixture created with
`setup.ts --count 96`. The accounts must be disjoint from the burst cohort.

```sh
bun deploy/athanor/spikes/node-first/blitz-setup.ts \
  --dir "$BLITZ_TRIAL" --fixture "$BLITZ_TRIAL/node-first-private.json" \
  --manifest "$TRIAL/native-world.json" --private-rpc "$PRIVATE_RPC"
bun deploy/athanor/spikes/node-first/blitz-flow.ts \
  --fixture "$BLITZ_TRIAL/blitz-private.json" --rpc-url "$PRIVATE_RPC" \
  --ws-url "$PRIVATE_WS" --out "$BLITZ_TRIAL/flow.json" \
  --seconds 600 --rate 20.3 --ready-file "$BLITZ_TRIAL/ready.json" \
  --burst-file "$BLITZ_TRIAL/burst-receipts.json"
```

After readiness, keep the steady flow alone for at least 120 seconds. Then run the warm 2,000-action burst with
`run.ts --receipt-checkpoint "$BLITZ_TRIAL/burst-receipts.json"`. That checkpoint records the first send and final
successful receipt on the shared monotonic clock before later evidence collection. The flow continues to 30 seconds
after the final burst receipt. Its output keeps the first 120 seconds, burst overlap and post-receipt period separate.
Join the individual action timestamps to the node's close records to distinguish the actual final seal from the rest of
that period. A missing or incomplete burst is not a passing mixed gate. Receipt block numbers are retained when supplied
by the node. Raw receipt visibility does not establish that Herald can serve this separate spike host.
