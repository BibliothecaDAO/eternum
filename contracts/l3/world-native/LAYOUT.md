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

The `map`, `troops` and `lifecycle` substorage names and `v0` component identifiers are stable. Appending a new field
inside a stored struct is not automatically compatible: the mapping value layout can overlap another value or change
nested offsets. This revision appends independent fields only.

`TileOpt.data` retains the existing 128-bit encoding: structure bit 0, occupier category bits 1–8, occupier id bits
9–40, biome bits 41–48, row bits 49–80, column bits 81–112, reward-extracted bit 113, layer bit 127. Occupancy updates
preserve the remaining bits. Troop category and tier serialization retain the existing zero-based variant order; storage
uses Cairo's native enum encoding. Herald consumes serialization, not storage slots.

The behavioral slice adds these independent component stores:

| Component          | Storage                                                                                                                                            | Layout rule                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameState`        | Games and immutable rules keyed by game; entity counters; points keyed by game and player                                                          | `GameRegistry` and `SliceRules` retain their field order. Changes to stored records need separate appended slots and an upgrade test.                       |
| `StructureState`   | Structure records and existence keyed by game and entity; explorer ids keyed by game, structure and index; ownership stored once in each structure | The variable explorer list has a fixed record count and indexed storage. Removal compacts that list and clears its tail.                                    |
| `ResourceState`    | Balances and production keyed by game, entity and resource; weight and `resource_exists` keyed by game and entity                                  | The full `Resource` row is a typed projection of these stores. Destruction clears every balance, production record and weight before emitting `RowDeleted`. |
| `BuildingState`    | Buildings and existence keyed by game, layer, outer coordinates and inner coordinates; building counts keyed by game and structure                 | Preserve the six-part building key and the three packed category counters.                                                                                  |
| `StructuresDomain` | Hyperstructure counts and seeds; immutable resource rules and their initialization flag                                                            | Configuration is set once for each game. Hyperstructure rows derive from the stored seed and structure category.                                            |

Component storage uses `v0` embedding. Field names must be unique across components embedded in the same domain;
component names do not isolate colliding field names. Resource existence therefore uses `resource_exists`, distinct from
structure existence. The populated replacement test remains the compatibility gate for each supported upgrade.

The slice implements the pinned season rules. Development provisioning supplies the initial realms, productive building
and portal fixtures; it requires domain authority and a development game. It does not expose a general storage writer.
Resource views return stored balances without harvesting. The authenticated production claim settles resources; spending
settles the affected resource before deducting it. LORDS production remains a reserved zero record, matching the pinned
resource store.

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
booleans are 0 or 1, and enums include their zero-based variant index. A span starts with its element count, followed by
serialized elements. The schema records fixed lengths where available and `null` for variable-length values, including a
structure’s explorer list. Decoders validate the complete type tree against the supplied frame length. Reject unknown
versions, unknown members, foreign emitters, missing required fields, invalid values and trailing data. Operational rows
keyed by contract address must name their actual emitter. Zero is a value, never a delete. Deletion is explicit;
subsequent recreation requires a complete `RowSet`.

The fixtures pair raw events with Herald's existing JSON projection: integers as hex strings, unit enums as names,
booleans as booleans. They include all three event shapes, a wrong-domain emitter and a truncated row. The Cairo event
test asserts the same ExplorerTroops key and serialized payloads, including a present explorer with zero troops and its
delete/recreate sequence.

The typed `BattleEvent` is an ephemeral combat notification. Its ABI declares its version, keyed participant ids,
coordinate, reward span and timestamp. It preserves the existing combat event payload so Herald can rebuild `LastBattle`
from confirmed history through its existing projection. It does not replace any storage mutation's row event.

## Authenticated command boundary

`SeasonDomain.execute` implements the published `IRecordedExecution` ABI from the path dependency
`../randomness-protocol`. `Intent`, `ExecutionContext`, admission and result types have one definition in that package.
The protocol's versioned canonical encoding supplies the action identity and envelope binding.

`Intent.arguments` contains Cairo Serde of exactly one typed `Command`: variant index followed by its fields.
`Intent.command` is Poseidon over `ETERNUM_COMMAND`, encoding version 1 and those serialized fields. The decoder rejects
unknown variants, malformed values, trailing fields and a different commitment. Authenticated malformed payloads consume
their accepted ticket with status 2; they cannot stop the deployment stream. The generated command ABI exposes the same
enum to consumers. Existing discriminants stay fixed; new commands append to the enum and regenerate the bindings.

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
oracle compares declared player-observable facts and rejection outcomes against the pinned original rules. Protocol
nonces and terminal results describe accepted-ticket consumption separately from Dojo's transaction rollback behavior.

## Upgrade evidence

`append_only_replace_class_preserves_and_mutates_existing_tiles` creates tiles in two games and both layers, populates
occupancy, executes `replace_class`, checks the new class hash and existing rows, initializes an appended field, and
mutates an old tile without changing the other game. This is storage compatibility evidence, separate from deployment
inspection.

`late_domain_failure_consumes_ticket_and_rolls_back_gameplay_rows` checks a real nested-call rollback while the accepted
nonce remains consumed. Its event spy includes reverted emissions and cannot establish receipt-level event removal; that
assertion belongs to the live transaction gate. Identity unit tests use registry/account interface fixtures; live
deployment must use the existing PlayerRegistry and approved RealmsPlayerAccount class.

## Ownership extension

Ownership commands append after the six original command variants. Structure transfers remain forbidden in Blitz and for
villages (stored category 5), reject zero recipients and require the owner. Same-owner transfers are no-ops.
`StructureState` updates only the owner field. Its unused owner-count map, view and row emissions are removed; clients
derive counts from ownership. The retired map name must not be reused. Agent ownership appends the `agent_owners` map to
the troops domain. It preserves the legacy controller-only rule, including zero recipients and assignments to
identifiers with no explorer row.

`FaithOwnershipState` is appended to the structures domain. It stores wonder accrual, pledges, player earning rates and
the ordered winner list with game-scoped keys. Transfers settle the old owner's accrued points at the recorded action
timestamp before moving rates. Pledge actions and faith prizes remain subsequent domain work. The history projection
uses an independently versioned native Story enum; decoded variant names and payloads match legacy history.

The rules row appends mode and faith-enabled fields, both included in the signed rules commitment. The deployment-wide
agent controller is an authority-managed field in the season domain, matching its chain-wide legacy scope. Old native
slice games require a fresh deployment or explicit compatible initialization before using these commands; an appended
per-game readiness flag rejects ownership transfers for older uninitialized games. Zero-filled appended fields do not
establish preservation of their intended immutable rules. The full-world populated upgrade gate must cover these fields
separately from class-hash inspection.

## Behavioural fact declarations

`schema/fact-models.mjs` defines native rows from ABI types and declares their observable fields. The generated
`schema.json` drives Herald and the client bindings. The paired-world fixture generates typed source adapters from the
same observable field declarations; it compares those facts after each action, never serialized Dojo rows or event
encodings. Oracle resources are read through the original read-only accessors. An event-shaped history assertion is not
a behavioural parity assertion. Native receipt reconstruction is tested separately.

Ownership removes the unused owner-count mirror and rewrites only the owner field. Faith ownership settlement writes the
final wonder record once instead of persisting an intermediate copy. Per-action trace evidence reports executed storage
syscalls, emitted events and felts, gas, and class sizes; retained transaction history establishes publication and
rollback behavior separately.

## Account naming

`StructuresDomain.address_names: Map<ContractAddress, felt252>` is appended without moving existing storage. The row is
keyed by account for the deployment, shared across its games. An absent or explicitly zero name displays as unnamed; a
zero write emits RowSet and is not a deletion. Names may be overwritten, including after a game's clock ends.

`SetAddressName` carries a name and one owned structure id. The structure is an authorization witness from the
synchronized store, not a second ownership fact. The domain validates its existence and owner in the action's game; no
owner-count storage or on-chain owner scan is needed. Internal calls require the authenticated season domain.

## Structure upgrades

`UpgradeState` appends to the season domain. Limits use `Map<game_id, Option<UpgradeLimits>>`: absence rejects an
unconfigured game, and a present value cannot be replaced. Recipes store ordered costs keyed by game, level and index;
one UpgradeRecipe row projects each level without retaining the oracle's resource-list entity ids. Configure emits
limits and complete recipes in one transaction. Old games need explicit initialization before accepting upgrades.

The structures domain validates ownership, clock, category and maximum level, spends the immutable recipe, then writes
only level and the two troop limits. The map domain changes a realm's displayed level without vacating or revealing it;
its command requires the structures domain and the matching realm occupant. Village tiles do not change on upgrade.
`LevelUp` appends command variant 9. `StructureLevelUpStory` appends history variant 1.
