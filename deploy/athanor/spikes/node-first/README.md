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
NODE_PID=$(docker inspect --format '{{.State.Pid}}' "$NODE_CONTAINER")
NODE_IMAGE=$(docker inspect --format '{{.Config.Image}}' "$NODE_CONTAINER")

bun deploy/athanor/spikes/node-first/run.ts \
  --fixture "$TRIAL/data/node-first-private.json" \
  --rpc-url "http://127.0.0.1:$((BASE+7))/rpc/v0_10_2" \
  --ws-url "ws://127.0.0.1:$BASE/rpc/v0_10_2" \
  --out "$TRIAL/data/node-first-results" --arms X,Y --work 32:256 --workers 8 \
  --node-pid "$NODE_PID" --node-image "$NODE_IMAGE" \
  --node-log "$TRIAL/data/node-first-node.log" \
  --node-metrics "$TRIAL/data/metrics/metrics.jsonl"
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
visibility/CPU/log windows. Tier 1 measures receipt visibility, not Herald/client rendering. Save node logs, proxy
ingress timings and the node's exact flags/config with it. Questions and build count are in the inbox log.

Tier 2 waits until ops has run tier 1 once. No Games redesign is implemented here.
