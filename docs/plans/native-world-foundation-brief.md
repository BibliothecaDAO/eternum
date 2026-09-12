# Native world foundation spike

Updated 2026-09-12. The Dojo World layer is replaced by a fresh native-Cairo world. Current games finish on the old
deployment; new games move only after the required native game paths pass their harness gates. A successful slice
authorizes further porting, not production cutover of an incomplete game.

## Prerequisite and scope

Land [PR #4963](https://github.com/BibliothecaDAO/eternum/pull/4963) before starting the spike and rebase on its merged
result. At this update the PR is open; its inspected head was `951f6c1f2f90dc18f6bb46da64a4be89d65cfa37`. Read both
documents before generating client bindings:

- [Hired-agents architecture brief](https://github.com/BibliothecaDAO/eternum/blob/951f6c1f2f90dc18f6bb46da64a4be89d65cfa37/docs/plans/hired-agents-architecture-brief.md)
- [Hired-agents milestones](https://github.com/BibliothecaDAO/eternum/blob/951f6c1f2f90dc18f6bb46da64a4be89d65cfa37/docs/plans/hired-agents-milestones.md)

The SDK is `@bibliothecadao/eternum/game-client` from that track. It consumes the schema artifacts generated in
commit 1. There is no new SDK package, second headless client or independent agent action implementation in this spike.
The web client and harness use the shared client. Scoped agent grants and hired-agent signing remain that track's
responsibility.

Scope: `contracts/l3/world-native` (Scarb, Cairo 2.13.1, no Dojo dependency), native Herald deployment routing/decoder,
schema artifacts for the shared game-client, `config/deployer/clean/world`, and `deploy/madara-lab/harness`. Keep the
persistent game_id design, Herald's snapshot/confirmed replay/pre-confirmed overlay, RECS authority and the existing
starknet.js deployer. Presets are immutable per game. No preset editing feature exists in this work.

Vendor cubit's required fixed-point math from a pinned revision, preserving its licence and provenance; the native
package must not depend on a personal fork branch, and combat calculations in commit 2 are its first native consumer.

One PR against `next`, five ordered commits, one per item below. Each passes its own gate and applicable required
checks: `scarb fmt`, `pnpm run format`, `pnpm run knip`. The
[mines, Bitcoin and village redesign](./native-world-mines-bitcoin-villages-frozen-brief.md) remains frozen on Dojo and
lands later in native domain commits.

## Foundation requirements from audit findings 1–8

1. **Deployment identity and emitter ownership.** Native domains emit from several addresses. Native ingestion retains
   emitter identity, validates each model's owner and orders all events in a transaction across domains before
   publishing its changes atomically. Route by deployment identity. Keep the Dojo world path byte-for-byte unchanged;
   isolate native routing instead of altering legacy decoding. Gate both the existing Herald suite and a live box replay
   of the old Dojo world, with unchanged folded rows.
2. **Storage, wire schema and projection are explicit.** Typed domain storage is not a generic World. RowSet,
   RowMemberSet and RowDeleted carry model identity, keys and serialized values that the decoder turns into FoldRow.
   Specify lengths, types, member IDs, zero/existence semantics and versions. Generate ABI-derived schemas plus explicit
   key/member ownership metadata once; Herald and game-client bindings consume them. Reject foreign emitters and
   malformed required rows. Preserve existing Eternum row projections and separate persistent state from history.
3. **Upgrades preserve rows and history.** Use replace_class per domain with a layout note per component. Append fields,
   never reorder; inspect nested and packed layouts explicitly. Record storage and wire-schema compatibility separately.
   Checkpoints carry schema identity, and historical replay uses the correct codec revision. The upgrade test populates
   old rows, upgrades, reads and mutates them, then reconstructs the result from pre-upgrade history.
4. **Authenticate the actor at entry and domains internally.** Commit 1 defines the authenticated-actor entrypoint.
   Intents use the player's existing gameplay key and identity-server/PlayerRegistry binding. Resolve the approved
   account's key and verify the intent directly; no second key scheme or arbitrary player validation callback. Internal
   commands authenticate the calling domain and receive the actor only through that trusted path. Test forged actors,
   wrong games, unavailable peers and late failures that undo earlier debits, placements and events.
5. **Resource reads do not hide mutations.** The current retrieve path can harvest and update weight. Native read-only
   views and explicit production settlement/spending commands must be distinct. Keep balances, weight, caps and time
   consistent in the owning domain, projecting to the existing client row where needed. Gate rounding, repeated claims
   at one timestamp, capped production, failed spending and delete/recreate behavior.
6. **Enumerate the slice's discovery outcomes before implementation.** Record every supported action/outcome, touched
   model, fixture and required config, including Ethereal entry. Unsupported outcomes fail explicitly. Never remove
   outcomes or change weights to make the slice pass: narrow the demonstrated parity claim, never the discovery pool.
   Dojo runs as a separate oracle deployment/test package; native dependencies, including test dependencies, exclude the
   Dojo framework. Pure game calculations can be ported without importing Dojo storage.
7. **Parity controls time, identities and randomness.** Pin the old rules revision, preset, starting IDs and timestamps.
   Inject identical raw roots and preserve the current derivation's order, salts, timestamp context, game scoping and
   increments. Compare every touched gameplay row after each action, including deletes and failures. Declare backend
   metadata normalization in advance. An embedded VRF can feed those same raw roots without changing the derivation.
   Named purposes and explicit counters come after parity in a versioned random-rules change with test vectors.
8. **Deployment has a recoverable initialization sequence.** Deploy domains under minimal bootstrap authority, configure
   their cross-references once, verify peers and activate. Reject public gameplay before activation and reject repeated
   initialization. The deployer records transactions and inspects hashes, references and activation. A repeated deploy
   submits nothing; an upgrade ends with synced inspection and readable old data. Class hashes alone do not prove
   storage compatibility.

## Five commits and gates

### 1. Storage, event and authenticated command contract

Create a handful of domain contracts with components, each owning its state: map, structures/resources, troops/combat,
economy and season. Implement only domains needed by the slice; no empty contracts waiting for future callers. Keep
game_id first in game-scoped keys. No contract per model, giant single contract, generic row setters or writer table.

Define the protected actor entrypoint, internal domain commands and generated schemas/bindings for
`@bibliothecadao/eternum/game-client`. Every persistent mutation emits RowSet, RowMemberSet or RowDeleted. Components
carry layout notes, and historical events retain the metadata needed by downstream consumers.

Gate: snforge tests for all three event shapes, game scoping, forged actors/domain callers and an append-only upgrade
that keeps populated rows readable. The generated artifacts have real decoder/client consumers in the following commits.

### 2. Behavioral vertical slice

Port explorer creation, tile exploration with discovery lotteries and the baseline surroundings rule, mine creation with
guards/production, resource production/claim and one troop battle through the combat calculations. Use direct storage in
each owning domain. Port the rules, not the Dojo call shapes. Enumerate the supported discovery outcomes before changing
code, retaining the original pool.

Gate: drive the same action sequence, raw randomness roots and execution context through the Dojo oracle and native
world. Compare every touched gameplay row step by step. Unsupported paths fail explicitly. List divergences with causes;
an unexplained gameplay divergence fails the gate. The frozen feature redesign is not folded into this parity
comparison.

### 3. Native Herald decoder

Route native Row\* events through deployment identity, emitter ownership and transaction-wide ordering. Keep the Dojo
path byte-for-byte unchanged. Snapshot, replay ring, overlay, HTTP semantics and RECS authority remain the same.

Gate: reconstruct the native slice from confirmed history alone, including deletes, delete/recreate, an upgrade and a
reconnect mid-game. Directory and leaderboard return the same non-empty expected rows as the live fold. Test a
disconnect between events from two domains in one transaction and rejection of a foreign emitter. All existing Herald
tests and a live box replay of the unchanged Dojo path pass.

### 4. Native deploy and upgrade

Extend the existing deployer with a native profile: declare domain classes, deploy, initialize peers, activate and write
the compatible manifest projection plus native release metadata. Inspect by class hash and initialization state. Perform
a fresh deploy and one in-place replace_class upgrade on the lab chain.

Gate: record deployment and upgrade transaction hashes, old-row readability and synced `--inspect`. Record class size
per domain and execution resources per slice action beside the same Dojo actions. A second unchanged deploy submits no
transactions. Keep storage-compatibility evidence separate from class-hash inspection.

### 5. Harness proof

Run one surface bot and one Ethereal bot through Herald and the shared game-client against the native deployment.

Gate: the run passes, with a machine-readable report containing parity results, exercised discovery outcomes, gas,
execution time, event volume, throughput and pre-confirmed-row latency alongside the matched Dojo baseline. No direct
client state-fetch bypass or narrowed discovery pool can make the run pass.

## Independent sequencing track

The [randomness brief](./native-world-randomness-brief.md) owns the separate crate, feature-gated Madara batcher patch,
protected ticket lifecycle, embedded/sidecar comparison and recovery gates. It plugs into the entrypoint from commit 1.
The slice uses injected raw roots while that work proceeds. Slice week and randomness week are planned and measured
separately; progress reports name passed gates and evidence, not percentages against an estimate.

The randomness track implements an owned RFC-9381-based Stark suite and must pass its cryptographic and integration
gates. No production value uses its draws before the primitive security review and required integration gates.

## After the slice

If commits 2–5 pass, continue porting in the same package as domain commits ordered by harness coverage. If parity or
Herald reconstruction cannot be fixed within the slice, record the failure evidence and stop before widening the port.
Full game, lifecycle and settlement coverage precedes production cutover. Existing deployments continue serving their
games; a fresh native deployment must not collide with old game IDs in shared ledgers or operator progress.

Commercial hosting is a post-port brief, with the hired-agents service as its first customer. Keep multiple-mode and
future-game expansion in the architecture, but do not implement a second SDK, generic hosting platform, billing system
or agent-grant scheme in this spike. Later portability requires another game's deployment, play, replay and upgrade
without introducing its model names or game rules into generic infrastructure.
