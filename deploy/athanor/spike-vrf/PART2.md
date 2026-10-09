# Transaction-hash VRF spike

Throwaway code; never merge or reuse without rewriting. The current operational handoff is
`~/projects/.reviewer-inbox/spike-node-first/randomness-handoff.txt`.

The stamp is the original three device felts followed by `VRF1` and five proof felts. The only seed is the ordinary V3
transaction hash. Verification is inline in each real-action host and reads its constructor public point; the root is
`Poseidon(3, gamma.x, gamma.y, 0)`. No epoch, registry, reveal or audit service exists. Constructor keys are immutable
in this spike. Baseline hosts are separate, explicitly deployed measurement controls.

`host-accounts.ts initialize` generates an independent `vrf-private.key` beside the host keys, mode 0600.
`part2-setup.ts PRIVATE_RPC ORIGINAL_FIXTURE HOST_DATA_DIR OUT_DIR` also initializes that file for a pre-existing trial
and builds suffix-compatible accounts. Public metadata is checked against the file; a missing registered key is never
regenerated. The proxy checks its fixture and key against the game's `vrf_config` before listening.

Real-action setup requires `--stamp-mode baseline|verified --vrf-key-file ...`. `--copies 4` prepares four games in one
host: wave0 is the full cold burst, excluded; waves1–3 are the measured warm bursts. Settle uses separate empty games,
so warming never consumes a measured seat. Verified Explore preparation signs ordinary addInvoke payloads and appends
their proofs locally on the shard; the public proxy never stamps simulation or estimation. Real-action runs skip the
legacy single-player simulation warm-up and rely on the full cold wave.

The loopback trusted proxy receives distinct synthetic client IPs from the sender driver. This keeps the existing
30-operations/minute IP budget intact and models separate players; an untrusted public peer cannot select its IP.

The full stamping benchmark includes hashing, worker dispatch, proof and hint generation, and the tagged suffix; startup
and reference correctness checks are outside the timed region. It excludes class/nonce RPC checks and network
forwarding. Laptop results on 9 October: 2052–2076ms / 1050–1074ms / 539–550ms on1 /2 /4workers. The four-worker run
does not clear500ms or reproduce390ms; it agrees with the retained same-machine541–558ms run. No new box result is
claimed. `probes.ts` is written for ops; it checks real actions and records missing trace coverage explicitly. No Cairo
test suite was run. The standalone native nonce test verifies eight valid nonce variants share one gamma/output.
