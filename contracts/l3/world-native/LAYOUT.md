# Native storage and row protocol, revision 1

Cairo 2.13.1 owns persistent storage. The row protocol is a projection for Herald; there is no public row writer. Each
game-scoped storage key starts with `game_id`. Presets remain immutable per game.

## Component layouts

| Component      | Storage, in declaration order                                                                      | Existence and upgrade rule                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Lifecycle`    | `state: DomainState`                                                                               | Constructor initializes once. Authority, peer addresses and activation are emitted together. Keep the nested `DomainState` and `Peers` field order and types; future fields go in new component storage slots. |
| `MapState`     | `tiles: Map<(u32,bool,u32,u32),u128>`, `exists: Map<(u32,bool,u32,u32),bool>`                      | Keys are game, layer, column, row. An absent tile returns `None`; existing zero values never imply deletion. Preserve both map names and key types.                                                            |
| `TroopState`   | `explorers: Map<(u32,u32),ExplorerTroops>`, `exists: Map<(u32,u32),bool>`                          | Keys are game and explorer id. Destruction clears existence; recreation overwrites the entire record. Preserve every nested struct and enum layout. New fields use separate storage slots.                     |
| `SeasonDomain` | `lifecycle` substorage, `authentication: Authentication`, `nonces: Map<(u32,ContractAddress),u64>` | Keys are game and gameplay account. An unused nonce is zero. Authentication fields and existing storage slots are never reordered.                                                                             |

`GameState` stores immutable games and rules, game-scoped entity counters, and points keyed by game and player. Its
stored record fields and map names retain their order; added fields use independent slots.

The `map`, `troops` and `lifecycle` substorage names and `v0` component identifiers are stable. Appending a new field
inside a stored struct is not automatically compatible: the mapping value layout can overlap another value or change
nested offsets. This revision appends independent fields only.

`TileOpt.data` retains the existing 128-bit encoding: structure bit 0, occupier category bits 1–8, occupier id bits
9–40, biome bits 41–48, row bits 49–80, column bits 81–112, reward-extracted bit 113, layer bit 127. Occupancy updates
preserve the remaining bits. Troop category and tier serialization retain the existing zero-based variant order; storage
uses Cairo's native enum encoding. Herald consumes serialization, not storage slots.

## Wire protocol

`schema/schema.json` is generated from compiled contract ABIs and explicit model ownership metadata by
`scripts/generate-schema.mjs`. Run `scarb run schema` after building the workspace packages. This is the only schema
generator. The SHA-256 identity covers the JSON object before its `identity` field is added. Deployments must pin that
identity and the matching codec for replay.

Events retain the emitting contract address. Event keys contain the ABI-derived component/event selector prefix, then
`version`, then short-string model identity. `RowMemberSet` adds a short-string member identity. Prefixes are explicit
in the schema; no decoder searches arbitrary event positions for a known selector.

- `RowSet` data: key length, serialized keys, value length, serialized values.
- `RowMemberSet` data: key length, serialized keys, member value length, serialized member value. Member ids identify an
  entire top-level member, including its nested values. A member update requires an existing row.
- `RowDeleted` data: key length, serialized keys. No value length or trailing data.

Lengths count felts. Serialization follows Cairo `Serde`: integers respect their bit width, `u256` is low then high,
booleans are 0 or 1, and enums include their zero-based variant index. Version 1 rows have fixed lengths recorded in the
schema. Reject unknown versions, unknown members, foreign emitters, missing required fields, invalid values and trailing
data. Operational rows keyed by contract address must name their actual emitter. Zero is a value, never a delete.
Deletion is explicit; subsequent recreation requires a complete `RowSet`.

The fixtures pair raw events with Herald's existing JSON projection: integers as hex strings, unit enums as names,
booleans as booleans. They include all three event shapes, a wrong-domain emitter and a truncated row. The Cairo event
test asserts the same ExplorerTroops key and serialized payloads, including a present explorer with zero troops and its
delete/recreate sequence.

## Authenticated command boundary

`SeasonDomain.execute` implements the published `IRecordedExecution` ABI from the path dependency
`../randomness-protocol`. `Intent`, `ExecutionContext`, admission and result types have one definition in that package.
The protocol's versioned canonical encoding supplies the action identity and envelope binding.

`Intent.arguments` contains Cairo Serde of exactly one typed `Command`: variant index followed by its fields.
`Intent.command` is Poseidon over `ETERNUM_COMMAND`, encoding version 1 and those serialized fields. The decoder rejects
unknown variants, malformed values, trailing fields and a different commitment. Authenticated malformed payloads consume
their accepted ticket with status 2; they cannot stop the deployment stream. The generated command ABI exposes the same
enum to consumers. Variants remain create explorer, explore, claim production, battle, movement and alternate-layer
travel, in that order.

Admission resolves the gameplay account through PlayerRegistry in both directions, checks the approved account class
before reading its existing key, and returns the immutable rules digest and current execution position. Execution checks
the sequencing account, transaction version 3, its authority epoch and transaction signature, and the exact recorded L2
gas bound. That authenticated authority attests to the player key accepted with the intent; execution verifies the
player signature with `accepted_public_key`. Later credential changes do not replace the key or invalidate a pending
signature. There is no player validation callback or additional key scheme.

The recorded timestamp governs discovery, production, stamina and combat. The shared `timestamp_in_bounds` rejects
future timestamps and ages above 300 seconds. Signed validity limits apply at recorded acceptance time. Expiry after
acceptance therefore does not cancel an action that still satisfies the execution skew. No entropy is generated in this
package; the lab authority supplies raw roots through the envelope.

The appended `RecordedState` component owns one deployment-wide ordered execution chain. `ExecutionHead` stores order,
binding, state-chain digest, recorded timestamp and root, in that order. Its result map is keyed by order and uses the
published `ExecutionResult` layout. Existing lifecycle, authentication, game-scoped nonces and game storage are
unchanged. Both new rows emit version-1 RowSet events with deployment address first; result keys append the order. Zero
status means no result exists. Result status 1 is successful gameplay and 2 is a terminal command or domain rejection.
The state digest commits to the preceding execution digest, action, binding and result; it is not a Merkle root of all
domain storage.

After authenticating the envelope, the season consumes the game/account nonce and invokes one domain command. A rejected
domain call rolls back that call's gameplay writes and events; the season records its terminal result and advances the
ordered chain. Invalid authentication or envelope framing rejects the transaction before consumption. An operational
failure of the enclosing transaction leaves the ticket with the sequencing journal for recovery; it never authorizes a
new root. Complete transaction data retains the accepted envelope and signature witness.

`set_authentication(submitter, registry, approved_account_class)` is restricted to the domain authority, validates
nonzero addresses and class hash, and emits the existing Authentication row. The sequencing account owns authority
epochs and credential rotation. `get_admission` and `get_result` expose the exact recovery interface used by that
service.

Season routes typed commands to configured peers. Map commands authenticate the owning gameplay domains. The paired
oracle still compares gameplay rows against the pinned original rules. Protocol nonces and terminal results describe
accepted-ticket consumption separately from Dojo's transaction rollback behavior.

## Upgrade evidence

`append_only_replace_class_preserves_and_mutates_existing_tiles` creates tiles in two games and both layers, populates
occupancy, executes `replace_class`, checks the new class hash and existing rows, initializes an appended field, and
mutates an old tile without changing the other game. This is storage compatibility evidence, separate from deployment
inspection.

`late_domain_failure_consumes_ticket_and_rolls_back_gameplay_rows` checks a nested-call rollback while the accepted
nonce remains consumed. Its event spy includes reverted emissions and cannot establish receipt-level event removal; that
assertion belongs to the live transaction gate. Identity unit tests use registry/account interface fixtures; live
deployment must use the existing PlayerRegistry and approved RealmsPlayerAccount class.
