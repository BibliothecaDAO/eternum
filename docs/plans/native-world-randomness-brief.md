# Native world randomness

Updated 2026-09-12. Sequencer-integrated randomness is the agreed direction. The earlier third-party VRF smoke passed,
but that primitive is rejected. Our own ECVRF is now the target; its cryptographic tests, sequencer integration and
end-to-end pre-confirmation latency remain outstanding.

## Decision

Generate randomness inside our sequencing infrastructure, with a pinned VRF implementation and Cairo verification. The
team operates and trusts the sequencer. No external randomness operator, proof endpoint or future block is required in
the gameplay path. This removes a separate operational dependency. Implement our own ECVRF using RFC 9381: a Rust prover
on the starknet-rs curve and field crates and a Cairo verifier on corelib ec, with try-and-increment hash-to-curve and a
verified square-root hint. Both implementations live in this repository under our licence and are pinned by our own
revision. The randomness module must contain no `stark-vrf`, `stark_vrf`, `cartridge_vrf`, Cartridge server or
Controller dependency, including vendored copies of the rejected primitive.

Continue executing game state changes on every action. Herald keeps its confirmed replay, shared pre-confirmed overlay
and authoritative client state flow. Computing the game state only at game end is a separate proposal and is not part of
this change. The mines, Bitcoin lottery and villages brief remains frozen until the native port reaches those domains.

## Action flow

1. The player or agent signs the complete action, including chain/deployment identity, game, actor, authorization,
   action nonce, arguments, rules/config revision and validity limits.
2. Sequencing validates and accepts the action, fixes its order, and persists its identity and execution ticket.
3. An embedded VRF generates a draw bound to that action, ticket and key epoch. Persist the witness before exposing it.
4. A sequencer-submitted, ordinary Cairo transaction verifies authorization and the witness, then executes the action
   through the owning native domains. Costs, outcomes and row events commit atomically.
5. Persist the execution result, then publish its rows through Herald's pre-confirmed overlay. Confirmation and replay
   use the recorded transaction witness and reproduce the same execution.

Retries keep the same action identity, ticket and witness. A block reaching capacity must not allocate a fresh draw.
Rules revisions and entropy key epochs remain fixed for accepted actions. Recovering the same outcome also requires the
same preceding state and execution context; persisting a seed alone is insufficient.

Intents use the player's existing gameplay key, bound through the identity server and PlayerRegistry. The native action
entrypoint resolves the bound gameplay account through the registry, reads its public key through the approved account
interface, and verifies the intent. PlayerRegistry currently maps owner/account addresses; it does not itself store the
public key. Keep this distinction explicit in the implementation. Authenticate the account implementation as well as its
address so the key lookup cannot become an arbitrary player callback.

There is no second action-key scheme. Scoped agent grants remain in the hired-agents track,
[PR #4963](https://github.com/BibliothecaDAO/eternum/pull/4963). Random gameplay must not execute inside an arbitrary
player-controlled multicall that can inspect a loss and revert it. Simulation and fee estimation must never request
production entropy. The three acceptance requirements are **no previews, no discarding losses, and no rerolls during
recovery**. The proof does not establish fair admission or fair ordering; operator trust remains the model.

The pinned Madara source already batches transactions before execution and re-executes saved transactions during restart
recovery. Its pre-confirmed persistence saves executed transactions, not an irrevocable accepted-action journal. That
journal is additional work. Sources:
[batcher](https://github.com/madara-alliance/madara/blob/e67432177060197bb0fb03502f2d07d1194764f5/madara/crates/client/block_production/src/batcher.rs),
[persistence](https://github.com/madara-alliance/madara/blob/e67432177060197bb0fb03502f2d07d1194764f5/madara/crates/client/db/src/lib.rs#L789),
[recovery](https://github.com/madara-alliance/madara/blob/e67432177060197bb0fb03502f2d07d1194764f5/madara/crates/client/block_production/src/lib.rs#L528).

## Owned patch, dependency and release

The randomness module is its own crate with one integration point in Madara's batcher, behind a feature flag. Keep
protocol, persistence and witness handling inside that module; do not scatter entropy hooks through Blockifier, syscalls
or RPC handlers. The batcher supplies the pinned execution order to the module. Both feature-enabled and
feature-disabled builds need their own gates at each Madara pin bump.

Build from `e67432177060197bb0fb03502f2d07d1194764f5` plus our reviewed patch. Record the base commit, patch revision,
feature configuration and built image digest in the release artifact. We own this patch and its rebase tests. The
documentation update does not claim that this image has been built or deployed.

The previous smoke used Cartridge's `stark_vrf` primitive; removing only its server and Controller dependencies was
insufficient. That primitive is out, including vendoring it under a local name. Write and maintain our own prover and
verifier, using the RFC construction and the permitted low-level curve operations. Pin every accepted curve dependency
and record its resolved revision/version/checksum, the owned prover/verifier revisions and suite version in the release
artifact. Release CI must reject direct and transitive dependencies on the discarded VRF/provider packages. If a chosen
low-level crate pulls them in, select a dependency path that excludes them.

RFC 9381 defines ECVRF suites for P-256 and Edwards25519, not the Stark curve. Describe our result as an owned Stark
suite based on RFC 9381. Specify the suite identifier, point/scalar encoding, hash, nonce derivation, challenge length,
proof/output encoding and validation rules before implementing it. Use try-and-increment hash-to-curve from RFC 9381
section 5.4.1.1, with a checked square-root hint. Specify the first valid candidate, point sign, counter encoding/bounds
and failure behavior so a caller cannot choose a different point by changing the hint or counter. Field arithmetic and
scalar arithmetic have different moduli. Key/point validation, canonical encodings, deterministic nonce handling and
secret scalar execution also need review. The RFC does not make those choices for this suite. Sources:
[RFC 9381, sections 5 and 5.5](https://www.rfc-editor.org/rfc/rfc9381.html#section-5),
[RFC 9381 try-and-increment](https://www.rfc-editor.org/rfc/rfc9381.html#section-5.4.1.1).

The smoke's public vectors are temporary development cross-checks only, then discarded. They describe the rejected
implementation's exact hash/encoding/nonce choices; they are not normative vectors for the owned suite. Compare only
operations with matching definitions and do not reproduce a discrepancy merely to match the old implementation. Land
owned test vectors for the chosen suite and cross-check both Rust and Cairo against an independent Python reference on
the same curve. The reference must not call either implementation or the rejected primitive. Cover malformed inputs,
invalid points/scalars, wrong keys/messages, hint/counter tampering and deterministic output. Repeat the primitive
benchmark for the replacement; no previous pass or timing is inherited.

Schedule a security review of the owned primitive and suite before value rides on draws; completion is not a testnet
blocker. The rejected primitive's successful smoke remains historical evidence only, not clearance of this replacement.

Generate full-width entropy keys from the OS, private to sequencing and separate from account keys. Never export them
through APIs, logs, manifests or client/agent artifacts. Publish only the verification key and epoch, and version the
witness envelope. Accepted actions retain their entropy epoch across rotation. Recovery and promotion must establish
access to the original protected key/witness material; generating a replacement key is not recovery. Record the secure
key-retention and promotion procedure before the failover gate.

## Historical local test: rejected primitive

The [machine-readable results](./evidence/native-world-vrf-smoke-2026-09-12.json) record a local test of the minimal
Rust VRF primitive and its Cairo verifier. No server, sequencer integration or chain deployment was involved. These
results apply only to the discarded `stark_vrf` implementation.

| Check                                  | Result                                             |
| -------------------------------------- | -------------------------------------------------- |
| Rust proof generation and verification | 210 inputs passed                                  |
| Identical input and key                | All 210 repeated proofs were identical             |
| Wrong game, wrong key, modified proof  | All 210 cases of each were rejected                |
| Rust/Cairo compatibility               | 16 generated proofs produced identical outputs     |
| Cairo rejection cases                  | 16 wrong-game and 16 modified-proof cases rejected |
| Cairo suite                            | 48 passed, 0 failed on Cairo 2.13.1                |

The historical test generated an OS-random full-width scalar key; the secret was not exported. It used Rust 1.98.0,
Scarb 2.13.1, and matching snforge/snforge_std 0.52.0. This is compatibility and rejection evidence, not a cryptographic
security audit or statistical proof of randomness.

| Local measurement                                   | Median   | p95      | p99      |
| --------------------------------------------------- | -------- | -------- | -------- |
| Complete witness generation: proof, hint and output | 1.064 ms | 1.882 ms | 2.142 ms |
| Rust proof verification                             | 0.638 ms | 1.092 ms | 1.134 ms |

Measurements used an optimized Rust build on a shared AMD Ryzen 7 5800H host, with 200 timed samples after ten warmups.
They exclude compilation, networking, durable recording, sequencing, Cairo execution and Herald delivery. Successful
Cairo test functions used 162,974 Sierra gas each, including fixture deserialization and assertions; that is not a
deployed transaction fee.

The wrong-game Cairo tests rejected by panic because the changed message invalidates the proof's square-root hint.
Modified response scalars returned verification errors. Retain explicit tests for both failure shapes in the action
wrapper even if the owned verifier returns structured errors. The wrapper treats both as rejected executions of the same
accepted ticket. Neither allocates another ticket or draw. Test both deployed wrapper paths explicitly, including retry
after rejection; a replacement draw is never the error-recovery policy.

## Pre-confirmation impact

The proposed flow requires no additional block wait or external VRF round trip. The random outcome can be executed and
published in the action's first pre-confirmed result.

It does add processing: witness generation, Cairo verification and durable recording. The measured 1.882 ms p95 is only
witness generation. End-to-end pre-confirmation impact is not yet measured, and zero added latency is not a claim of
this brief. If published results must survive primary-host loss, replication must finish before publication; include
that acknowledgement in the latency measurement.

## Predeclared comparison budget

Measure one deployed explore with verification against today's explore, recording gas, execution time and time from
submission to the pre-confirmed row. Keep chain pin, hardware, cadence, action mix, discovery fixtures and offered load
identical. Run the embedded and sidecar versions with the same accepted-ticket protocol and durable-recording policy.
The sidecar submits through its own account; verify ticket-order enforcement under competing submissions and retries.

Before collecting results, freeze the run manifest, warmup/sample counts and workload. The initial acceptance budget is
at most **+25 ms p95** and **+50 ms p99** submission-to-pre-confirmed-row latency versus baseline, at least **95%** of
baseline sustained throughput, and no additional failed actions or ticket-order violations. These are proposed
engineering tolerances fixed here before the run, not measured results. Report p50/p95/p99 for gas and execution time as
well as row latency; do not hide tails in averages or change the budget after seeing results. A result inside the budget
is described as within budget. Claim no measurable impact only if the comparison supports that narrower claim.

The rejected implementation’s 1.882 ms p95 local generation cost was small beside the 250 ms pre-confirmed cadence.
Repeat this measurement for the owned ECVRF. It does not account for the Cairo verifier or the complete deployed action.
Choose embedded placement on the measured comparison, including its ordering/recovery behavior and the maintenance cost
of the patch; the preferred direction remains embedded.

## Next integration gate

Prove one protected random action through sequencing, Cairo and Herald. This track runs independently of the native
slice; the slice does not wait for live entropy to prove parity with injected roots.

- Submit a signed action, persist its ticket and witness, execute it, and compare pre-confirmed rows with confirmed
  replay.
- Attempt previews through simulation, estimation, zero fee bounds and direct proof requests.
- Test malicious account validation, a losing-result revert, callback, extra multicall and insufficient execution bound.
- Exercise both verifier failure modes through the deployed wrapper; retry preserves the accepted ticket and draw.
- Retry duplicate submissions and defer an action across a full block; each must retain one identity and witness.
- Crash at persistence boundaries, restart and promote a fenced replica. Recover the accepted ordered prefix or stop
  affected actions rather than silently rerolling them.
- Disable access to external randomness providers and prove the complete action still succeeds.
- Compare sidecar and embedded submission using the same protocol, including ticket order under competing traffic.
- Rotate entropy keys while actions are pending; accepted actions retain their original epoch and witness version.
  Per-game presets remain immutable; no preset editing feature is introduced.
- Compare p50/p95/p99 end-to-end latency under the same actions and load as today's baseline, breaking out admission,
  durable recording, witness generation, Cairo execution and Herald visibility. Set the allowed regression before the
  run.

The fsync conversion defect was reported upstream as
[issue #1257](https://github.com/madara-alliance/madara/issues/1257), followed by
[draft PR #1258](https://github.com/madara-alliance/madara/pull/1258), with a dependency-free source-level reproduction.
The one-file fix is commit `a0b1d029cc2cf9433cd5ea8ff99ec85105ad5f9c`; it passes the source-level reproduction,
repository-configured rustfmt and diff checks. Full mc-db and real RocksDB/recovery tests remain unrun. The original
conversion failed; `opts.set_sync(self.fsync)` passed all four WAL/fsync combinations. This tests the conversion against
an instrumented WriteOptions stand-in with the pinned wrapper's documented default, not real database persistence or
power-loss recovery. Our build must carry the fix until upstream merges it and the adopted pin contains it. Track the
fix in the same release artifact; a real RocksDB integration check and recovery drills remain required.

## Relationship to the native slice

[Native spike commit 1](./native-world-foundation-brief.md) defines the authenticated-actor entrypoint and narrow
internal domain commands. The randomness module plugs into that entrypoint. The parity gate injects raw roots into
today's derivation, preserving draw order, salts, timestamp context, game scoping and increments. A VRF root feeding
that unchanged derivation retains parity. Named purpose domains and explicit counters follow parity as a versioned
random-rules change with public test vectors.

For the later Bitcoin lottery, bind entropy once per phase and derive draws per phase/mine. Claimant, batch composition,
batch order and retry must not affect the draw. This is recorded in the
[frozen feature brief](./native-world-mines-bitcoin-villages-frozen-brief.md).

Slice week and randomness week are separate tracks and are measured separately. Report completed gates and their
artifacts, not progress against an estimate. The five native commits stand; the local cryptographic smoke does not
complete the deployed action, parity or harness gates.
