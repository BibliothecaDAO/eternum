Throwaway spike. Never merge or reuse without rewrite.

The paired `VrfYProbe` uses tier1 Y's caller/run-keyed attempts and word writes, with identical configurable
storage/hash work. Two immutable constructor modes select baseline and proof verification. Both check work, tip and the
fixed L2 bound before work; verified mode derives and uses the transaction-hash root. Neither writes a game
counter/head. Both use the same suffix-compatible account class. Baseline forwards the original signature; verified mode
appends five proof felts through four Bun/native workers.

The original 2,000 RealmsAccounts cannot accept a proof suffix. Setup makes separate scratch accounts using their same
device keys and an isolated local guardian; existing accounts, world configuration and identity services are unchanged.
Setup checkpoints private fixtures and is safe to resume. Its artifacts were compiled with Cairo2.17 on DEV (four
attempts total including two dependency failures); ops needs no Cairo rebuild or suite.

After the current timed X/Y waves finish, from the prepared DEV checkout with the published spike subtree and existing
built workspace dependencies:

```sh
TRIAL=/opt/athanor/runs/spike-node-first-20261008/ops-node-first-20261008
VRF=/opt/athanor/spikes/vrf-arm
PART2="$TRIAL/vrf-part2"
BUN=/opt/athanor/tools/bun/bin/bun

taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/part2-setup.ts \
  http://127.0.0.1:29300/rpc/v0_10_2 "$TRIAL/node-first-private.json" \
  "$PART2" "$VRF/benchmark-key"
```

Use the retained native library at `deploy/athanor/spike-vrf/prover/target/release/libnode_first_vrf_prover.so`; copy it
from `$VRF` into this checkout if needed. It requires GLIBC2.34 or newer. Symlink the existing workspace dependency
directories when using an overlay checkout; do not print fixture/key files.

Run the same command once with `MODE=baseline` and once with `MODE=verified`, repeating paired trials only after both
runs complete. Resolve the actual Madara descendant PID using the existing node-pid.py, never sample tini. The
sampler/log/metrics/image arguments must name the same node and observers as tier1.

```sh
MODE=baseline
NATIVE_WORLD_MANIFEST="$TRIAL/native-world.json" \
NODE_RPC_URL=http://127.0.0.1:29300 \
RPC_TRUSTED_PROXY=127.0.0.1 PORT=29308 \
SPIKE_PART2_FIXTURE="$PART2/part2-$MODE-private.json" \
SPIKE_VRF_KEY_FILE="$VRF/benchmark-key" \
taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/proxy.ts > "$PART2/proxy-$MODE.log" 2>&1 &
PROXY_PID=$!

taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/part2-run.ts \
  --fixture "$PART2/part2-$MODE-private.json" \
  --rpc-url http://127.0.0.1:29308/rpc/v0_10_2 \
  --ws-url ws://127.0.0.1:29300/rpc/v0_10_2 \
  --out "$PART2/results-$MODE" --arms Y --work 32:256 --workers 8 \
  --timeout-ms 600000 --node-pid "$MADARA_PID" \
  --node-image "$NODE_IMAGE" --node-log "$NODE_LOG" \
  --node-metrics "$TRIAL/metrics/metrics.jsonl"
kill "$PROXY_PID"
```

A timeout of600s observes a slow run; it never changes the under5s/2s verdict. Send spread >=100ms, missing/reverted
receipts, stream failure or incomplete gas coverage stay explicit. Visibility is pre-confirmed receipt arrival, not
Herald/client painting. Gas reads occur after timed CPU/visibility/counter snapshots. The initial digest includes the
root so the compiler cannot discard its derivation. This adds one common digest input to both modes compared with
original tier1Y; compare the pair, not unrelated work configurations.

Separate complete-proof and full-stamp CPU measurements (no live invokes; outside node measurement windows):

```sh
taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/benchmark.ts \
  "$VRF/benchmark-key" "$PART2/native-proof-benchmark.json"
taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/part2-presign.ts \
  "$PART2/part2-verified-private.json" http://127.0.0.1:29300/rpc/v0_10_2 \
  "$PART2/presigned-private.json" 32:256
# CHAIN_HEX is the public chainId in part2-public.json.
taskset -c 20-23 "$BUN" deploy/athanor/spike-vrf/stamp-benchmark.ts \
  "$VRF/benchmark-key" "$PART2/presigned-private.json" "$CHAIN_HEX" \
  "$PART2/full-stamp-benchmark.json"
```

Each benchmark reports1/2/4threads, three repetitions, throughput and elapsed time. Full-stamp includes transaction
hashing, worker dispatch, complete proof+hint and suffix copying; excludes class/nonce RPC checks and network
forwarding. Paired end-to-end runs include those costs. Under500ms is the stamp bar; the native-only result must not
stand in for it.
