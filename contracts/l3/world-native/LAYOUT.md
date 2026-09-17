# Native storage and row protocol

Cairo 2.13.1 owns persistent storage. The row protocol is a projection for Herald; there is no public row writer. Each
game-scoped storage key starts with `game_id`. Presets remain immutable per game.

The settlement split and packed storage below require a fresh rehearsal deployment. No upgrade compatibility from the
earlier slice is claimed. The populated replacement test covers append-only upgrades within this layout.

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
preserve the remaining bits. Troop category and tier serialization retain the existing zero-based variant order. Their
packed storage is described below. Herald consumes serialization, not storage slots.

The behavioral slice adds these independent component stores:

| Component          | Storage                                                                                                                                                                       | Layout rule                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GameState`        | Games and immutable rules keyed by game; entity counters; points keyed by game and player                                                                                     | `GameRegistry` and `SliceRules` retain their field order. Changes to stored records need separate appended slots and an upgrade test.          |
| `StructureState`   | Structure records keyed by game and entity; existence derives from nonzero category; explorer ids keyed by game, structure and index; ownership stored once in each structure | The variable explorer list has a fixed record count and indexed storage. Removal compacts that list and clears its tail.                       |
| `ResourceState`    | Balances and production keyed by game, entity and resource; weight and `resource_exists` keyed by game and entity                                                             | Sparse `ResourceBalance`, `ResourceProduction` and `ResourceWeight` rows expose these stores. Destruction clears each existing row explicitly. |
| `BuildingState`    | Buildings keyed by game, layer, outer coordinates and inner coordinates; building counts keyed by game and structure                                                          | Existence derives from nonzero category. Preserve the six-part key and three packed category counters.                                         |
| `ProductionState`  | Recipe readiness by game; recipe terms by game and resource; ordered inputs by game, resource, recipe kind and index; bonuses by game and structure                           | Recipes are immutable. Bonus percentages and end ticks occupy one packed felt; zero means no bonus. Preserve field widths and packing order.   |
| `StructuresDomain` | Hyperstructure counts, seeds and completion flags                                                                                                                             | Configuration is set once for each game. Hyperstructure rows derive from the stored seed, completion flag and structure category.              |

Component storage uses `v0` embedding. Field names must be unique across components embedded in the same domain;
component names do not isolate colliding field names. Resource existence therefore uses `resource_exists`, distinct from
structure existence. The populated replacement test remains the compatibility gate for each supported upgrade.

Resource rules store weight, the two 64-bit production rates packed together, and labor conversion in three slots. The
resource id exists only in the map key and is reconstructed in the view. Building population and capacity terms now live
only in per-category building configuration, rather than also in each resource rule.

Production bonuses pack the resource, labor and troop percentages into three 16-bit fields, followed by their three
32-bit end ticks, for 144 bits. Expiry is evaluated against the recorded action tick, with the end tick inclusive; it
does not mutate the retained bonus definition. Building storage packs category (8 bits), structure id (32 bits) and
paused (1 bit) into one 41-bit word. Coordinate keys identify buildings; unused building ids and the never-written bonus
percentage are absent from storage and events. The allocator increment is retained for later gameplay identities. Its
separate presence map is removed. Immutable per-category building terms and ordered erection costs use appended maps.
Population uses one 64-bit word for current and maximum values. Structure building counts no longer repeat the structure
coordinate. These packing and projection changes require a fresh rehearsal; no live upgrade from the previous building
layout is claimed.

The slice implements the pinned season rules. Development provisioning supplies the initial realms, productive building
and portal fixtures; it requires domain authority and a development game. It does not expose a general storage writer.
Resource views return stored balances without harvesting. The authenticated production claim settles resources; spending
settles the affected resource before deducting it. LORDS production remains a reserved zero record, matching the pinned
resource store.

`StructuresDomain` appends `completed_hyperstructures`, keyed by game and entity. A true flag identifies an initialized,
completed Blitz hyperstructure; existing discovered foundations retain the false default.

Settlement uses `SettlementState` in the settlement domain and `SettlementPoolState` to map as independent component
stores. `settlement_rules` and realm grant entries are immutable once configured; their absence is not a default preset.
The pool stores candidate ordinals under `(game_id, village, index)` and a live count; coordinates are projected from
the immutable grid rules. Removed tail entries are inaccessible past that count. Biome starting troops and realm
resource traits are immutable grant tables initialized per game; neither table is compiled into settlement rules.
`SettlementState` appends entry entitlements keyed by game and bound owner, and a player membership index for the
existing duplicate-player guard. Only `PlayerEntry` projects entitlement consumption; the index is not another client
fact. Realm grants and upgrade costs share the `ResourceAmount` value type; its `(resource_type: u8, amount: u128)`
layout is unchanged from the former upgrade value.

`TroopState` appends `agent_count: Map<u32,u16>`. Explorer creation and destruction maintain it only for the reserved
agent home id. Settlement displacement preserves this population through `AgentPopulation` events. No existing explorer
field or map key changes. Earlier native slice deployments could not create agents; the initial count is zero.

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

Schema version 2 declares native rows and immutable events directly. It contains no absent-collection list or synthetic
`LastBattle` projection. The typed `BattleEvent` retains participant accounts, categories, tiers, before/after troop
counts, rolls, coordinates, rewards and recorded time even when an army is deleted. `RaidEvent` retains the raid
outcome; `PointsAwarded` retains each credited amount and activity without adding a second balance. Herald stores these
as immutable history and folds current facts only from row events. The schema/codec change requires a fresh rehearsal
deployment; no live upgrade compatibility with the earlier codec is claimed.

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
future timestamps, with no maximum age for accepted contexts. Signed validity limits apply at recorded acceptance time.
An outage never cancels an accepted action; recovery executes its original context and root in order. No entropy is
generated in this package; the lab authority supplies raw roots through the envelope.

The appended `RecordedState` component owns one deployment-wide ordered execution chain. `ExecutionHead` stores order,
binding, state-chain digest, recorded timestamp and root, in that order. Its result map is keyed by order and uses the
published `ExecutionResult` layout. Existing lifecycle, authentication, game-scoped nonces and game storage are
unchanged. Both new rows emit version-1 RowSet events with deployment address first; result keys append the order. Zero
status means no result exists. Result status 1 is successful gameplay and 2 is a terminal action rejection. The existing
result felt stores the output commitment on success and the ASCII reason code on rejection; older rejection commitments
stay opaque and readable. No field or storage slot is added. The state digest commits to the preceding execution digest,
action, binding and result; it is not a Merkle root of all domain storage.

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

Authenticated next-order action rejections advance the recording head. Only a matching actor nonce with representable
keys and successor advances; stale or unrepresentable nonces remain untouched. Envelope and authority failures precede
all mutations. These are protocol consumption facts, independent of the gameplay parity projection.

The settlement component appends a game/biome-keyed starting-troop table. Configuration requires all 17 playable biomes
and writes the table once with the other immutable realm grants. Production code reads these values instead of embedding
the biome assignment table. The schema and test input derive from the settlement fixture; the parity gate checks the
assignments against the pinned game's troop rules. Existing component fields retain their order.

Resource facts use `ResourceBalance(game_id, entity_id, resource_type)`,
`ResourceProduction(game_id, entity_id, resource_type)` and `ResourceWeight(game_id, entity_id)`. The existing balance,
production, weight and existence storage maps keep their keys and offsets. Zero balances and inactive production have no
row; `ResourceWeight` establishes the resource owner's existence. Returning to zero emits a deletion. Unchanged values
emit nothing and perform no storage write. The wide resource view and both resource-member name tables are deleted; the
read-only views expose these facts directly. Existing native history uses its original schema revision. This codec
change requires a fresh native rehearsal deployment; it must not be activated against a fold built with the previous
resource projection.

Settlement arguments retain the admission-time PlayerRegistry wallet, each cosmetic token's owner and attributes, and
the L1-finalized L2 block hash and number used to verify those facts. They are part of the signed command commitment and
recorded transaction data, not another current-state row. Settlement stores only the granted attributes keyed by game
and player. Later registry rebinding or collectible transfers are not read during execution. Gameplay registration
remains required; unbound accounts cannot reach cosmetic eligibility. L2 locks use real time and cannot revert L3
settlement. Tile presence remains explicit to distinguish a valid zero row; existing tiles no longer rewrite that flag.

`RealmState` appends to SeasonDomain. Immutable canonical traits use one packed u32 per realm id; the catalogue count
and ordered Poseidon digest make interrupted deployment initialization resumable and auditable. Initialization appends
records and cannot rewrite a prefix. The schema projects decoded RealmTraits and catalogue progress. These are shared
deployment facts, not per-game copies of the same 8,000 records.

Allocation keys start with game_id. Sparse forward and reverse pool indices implement swap removal; unwritten entries
denote the identity permutation. Remaining count is derived from SettlementProgress.realm_count instead of retaining a
second counter. Internal permutation writes have no independent player fact. Removed realms retain their former tail
index outside the active prefix, which rejects duplicates without a separate allocation-player map or row. Realm
ownership, wonder identity and location remain in Structure; there is no duplicate Wonder row. SettleSeason appends
command variant 14. Its owner is the retained admission wallet; execution does not re-resolve a binding that might have
changed during recovery.

## Village rehearsal layout

This revision requires a fresh native rehearsal deployment. No live upgrade compatibility with the earlier slice is
claimed. Settlement allocation, immutable grants and pass entitlements move from Season to Settlement; Season retains
recorded execution and authentication. `Peers` gains the Settlement address. Cross-domain creation authenticates
Settlement; direct player commands still enter only through Season's recorded execution interface.

Structure existence is its nonzero base category. The separate existence map, duplicate category and village count are
removed. `StructureBase` occupies one felt: counts, limits, creation time, level, category and the granted flag use bits
0–96, and layer uses bit 97; coordinates use bits 128–191. Structure metadata occupies one u128: realm id at bits 0–15,
Order at 16–23, wonder at 24, connected realm at 32–63 and mine kind at 64–71. The gaps are zero. These layouts retain
the full ranges of their fields.

`Troops` occupies four slots: u128 count, two u64 stamina fields in one u128, packed boosts and combat flags. Combat
stores category at bits 0–1, tier at 2–3 and cooldown at 4–35. Boosts store damage, defense and stamina at bits 0–119,
then exploration at 128–175. The struct's public serialization is unchanged. Immutable stamina, troop-limit and map
rules each occupy three u128 words, packing consecutive fields without crossing a word boundary.

The settlement planner keeps two candidate pools under `(game_id, village)` and one coordinate reservation map under
`(game_id, x, y)`. Both use the existing grid. Pending realm candidates are reserved before village candidates,
including Duel's two fixed entry bundles. A village candidate always contains one coordinate; its pool has no entry
quota. Reservations survive candidate consumption, so neither pool can reuse a claimed location. Pool events project the
available candidates; placed settlements project through Structure and TileOpt. The reservation map is internal planner
state, not a second client occupancy fact.

Village rules, indexed grants and all 22 ordered resource/weight pairs are immutable per game. Passes use
`(game_id, pass_id)` and store owner plus the consuming village id; zero means unused. A pass is consumed only after
successful creation in the same call, so rejected placement rolls back both reservation and consumption. The existing
structure troop-grant flag records village army claims; there is no separate claimed row or per-realm village counter.

## Resource rehearsal layout

Resource state and its immutable rules now belong to ResourcesDomain. Structures owns buildings and settlement
provisioning; Troops owns armies and combat. Both call Resources through authenticated internal commands. Direct
resource actions require Season, and the internal grant/spend and explorer-capacity commands accept only their owning
domain. Peers appends the Resources address; this six-domain topology requires a fresh rehearsal deployment.

Production packs its existing 232 bits into one felt: output cap at bits 0–127, rate at 128–191, settlement timestamp at
192–223 and building count at 224–231. Serialization and observable values retain their full ranges. Balances and
production are settled in memory before a mutation writes their final values; failed actions retain neither intermediate
state nor events. Explicit burns and weight regularization read stored balances without harvesting production. LORDS and
relics have no production state.

ResourceAllowance uses `(game_id, owner_entity_id, approved_entity_id, resource_type)` and stores one u128. Absence
means zero approval; unchanged approvals write nothing, and revocation emits RowDeleted. Resource rules are written once
per game, in resource-id order. No gameplay mutation can change those rules.

An inactive production slot has no accrual timestamp. The fact declaration projects that timestamp to zero in both
worlds. Activation first settles at the recorded command time, then enables the new production rate; it cannot accrue
for the inactive interval. Native storage omits that inactive clock, so untouched zero production no longer gains a row
when balances are granted, spent or claimed.

ArrivalState stores one ordered list per `(game_id, entity_id, day, slot)`, with a packed u64 head/count and indexed
ResourceAmount entries. Slots retain the original range 1–48 and delivery-tick timing. Offloading advances the head;
consumed backing entries are outside the live range and have no row. Empty slots have no ResourceArrival row and emit
RowDeleted when consumed. There is no initialized-day flag, repeated 48-member record or stored day total. Positive
queued amounts make the total a read-time sum of the live slots. Partial offloads preserve order; capacity truncation
consumes the requested prefix, as in the original game.

SliceRules appends the immutable two-field SpeedConfig (normal and troop seconds per hex). Its values come from the
pinned preset. Transport reads those values, the existing donkey capacity and delivery interval; village connections are
never consulted for transfer eligibility. Duplicate resource ids are rejected before transfer mutations.

## Mine configuration

ResourcesDomain appends MineState substorage. Its immutable kind configuration is keyed by `(game_id, kind)` and stores
resource, building, production rate, minimum cap and step count. The cap is minimum multiplied by a draw from 1 through
step count, using the existing salt 124 and the same discovery root. Fragment mines retain minimum 300,000 and ten
steps; a one-step kind has a fixed cap. Configuration rejects zero values and an overflowing maximum cap.

The discovery pool uses `(game_id, layer)` with a count and ordered `(kind, weight)` entries. An empty Ethereal pool
disables ordinary mines there; drawing from an empty pool rejects. Positive weights must refer to configured kinds.
MineKindConfig and MinePool are the authoritative rows. The internal configured flag prevents a second initialization;
it is not a separate player fact.

Mine kind is stored in Structure metadata. The layer is stored explicitly because ordinary mines may inhabit either
layer. Discovery guard preparation belongs to TroopsDomain; it preserves each guard's type, tier, seed and recorded
time.

## Guard and Bitcoin rehearsal layout

Guard state belongs to TroopsDomain in `GuardState.guards`, keyed by `(game_id, structure_id, slot)`. Slots 0 through 3
are Delta through Alpha. Each row contains troops and its destruction tick; a default slot is absent. Structure records
no longer embed four guard slots or store a redundant live-guard count. Their packed base leaves bits 0–7 unused. These
changes require a fresh rehearsal deployment; no upgrade compatibility with earlier structure records is claimed.

ResourcesDomain appends `BitcoinState`: phases `(game_id, phase)`, contributions `(game_id, phase, player)`, contributor
indexes `(game_id, phase, index)`, mine accounting `(game_id, mine_id)`, and claimed markers
`(game_id, phase, mine_id)`. Its settlement-id index supports nearest-destination lookup; owners and coordinates are
read from StructuresDomain. Closing a phase prevents contributions. A later recorded command binds its root once; claims
never use their own roots. Each mine processes phases in order so rollover cannot target an already paid phase. Unsplit
prizes, forfeited winner shares and forfeited owner shares have separate balances; only unsplit prizes receive an owner
cut. A missing destination for one recipient does not affect the other recipient's payment.

`EconomyDomain` owns `TradeState`: orders keyed by `(game_id, trade_id)`, an internal open-order count keyed by
`(game_id, maker_id)`, and immutable trade limits keyed by game. Maker id zero means an absent order. A partial fill
writes only the remaining-lot field; cancellation and full fill clear the maker sentinel and emit a deletion. The
open-order count is an index for enforcing the limit, not a second client fact. Escrow is represented by the order;
resources are debited once at creation and arrivals remain owned by `ResourcesDomain`.

The lifecycle peer set adds the economy address. This changes the nested peer layout and requires the same fresh
rehearsal deployment as the row changes above; no compatibility with an existing live deployment is claimed.

`MarketState` appends to the economy domain with globally pooled reserves per `(game_id, resource_type)` and liquidity
shares per `(game_id, player, resource_type)`. Bank names use `(game_id, bank_id)`; owner, position and guards remain in
their owning domains. Market terms use `bank_rules` and `bank_rules_configured` so component storage cannot alias trade
rules. A zero-share position emits a deletion. Empty markets retain their explicit zero reserves.

`WithdrawalState` owns game-scoped withdrawal terms, an immutable retention ladder indexed by completed hyperstructure
count, and the resource-token whitelist. Its projected rules include the ladder; the internal length is only the storage
representation of that span. Token amounts retain the external token's decimals. Completed counts are read from the
hyperstructure component below. Regional bank ids retain the six reserved values below the maximum entity id.

Bridge owns `WithdrawalState` and `BridgeState`; Economy calls Bridge for external bank-liquidity payouts. Bridge stores
immutable deposit terms in `deposits: Map<game_id, Option<DepositRules>>`. Arrival balances and weights remain in
Resources. Village bridge fees use the stored connected realm and its current owner; withdrawal fees retain transport
time and donkey costs. The fee is carved out of the withdrawal rather than burned a second time. `Peers` appends Bridge;
moving withdrawal custody and extending this topology requires a fresh deployment, with no live upgrade compatibility
claimed for the earlier topology.

Hyperstructure construction is owned by Economy. `HyperstructureState` stores one stage instead of overlapping
initialized/completed flags, sparse contributed amounts keyed by `(game_id, structure_id, resource_type)`, immutable
construction ranges, and a shareholder allocation with its accrual cursor and multiplier. Requirements and completion
counts are derived from the configured ranges and hyperstructure records; there is no total-progress or global-count
row. The private discovery index supports the discovery lottery and completion enumeration. Tile occupancy identifies
the structure and does not duplicate its construction stage. The former Structures hyperstructure storage is removed;
this codec/layout change requires a fresh rehearsal deployment. The private construction-rule count stores length plus
one: zero means unconfigured, and one represents Blitz's empty construction recipe. This encoding also requires the
fresh deployment; it is not compatible with earlier count values.

Season owns player points and the aggregate used by prize settlement. `PlayerPoints` and `PointsTotal` replace the
placeholder prize projection. Guild membership is read from Registry for construction permissions.

Economy appends immutable `RelicState` rules keyed by `(game_id, relic_id)`. Map appends the game's last chest-discovery
time and immutable exploration-reward entries. Relic effects reuse the existing troop boosts and production bonus;
chests use tile occupancy and extraction uses the existing packed tile bit 113. Neither has a duplicate status row.
Relic rules retain all eighteen entries, including zero discovery weights. Exploration pools are ordered immutable
configuration; their weights and whole-unit rewards are supplied by the preset, with no tables embedded in bytecode.

GameState appends an optional victory threshold keyed by game. `None` means unconfigured and a configured zero disables
point-triggered closure. Closing a season updates its existing end time and status after checkpointing completed
hyperstructures; no duplicate end-state row is stored. The winner is part of immutable season-end history.

Faith state moves from the ownership module into its own component module, retaining Structures' `faith` substorage and
its existing maps. Immutable rates and blacklist entries append there. Pledges and blacklist entries emit deletes when
cleared. Wonder and player accrual remain in that component so ownership transfers settle the same facts that pledge and
claim commands read; there is no second ownership or score ledger.

Faith winners are a read-only aggregate of the wonder score rows, not a second stored leaderboard. The previous
high-score and tied-winner maps and their row projection are removed. An id-only initialized-wonder index supports that
view; tied winners have equal rewards regardless of listing order. This layout change joins the fresh-rehearsal codec
change and makes no live upgrade claim.

PrizesDomain owns token custody separately from structure accrual. Its game-scoped immutable reward-token map,
funded/distributed pool and `(game_id, player, wonder_id)` claim markers reserve awards per game. Wonder prizes derive
from the frozen scores and pool; no per-wonder prize allocation duplicates those facts. Only Prizes may settle faith
scores for distribution, and only Season may issue payout commands. The lifecycle peer set appends `prizes`; this nested
layout change requires the fresh rehearsal deployment already required above.

Prizes appends `BlitzPrizeState`: immutable series chest terms and the rolling controller state keyed by series id; game
chest allocation and ranking trial keyed by game; one rank/award row keyed by game and player; and an internal ordered
player index for batch continuation, tie allocation and reset. No per-rank counts, duplicate rank lists or cached ring
sums are stored. Series records are shared deployment facts, while every game record begins with game id. Ranking resets
emit deletions; finalized rankings and game chest allocations cannot be reset or allocated twice.

RelicState appends an optional research cost keyed by game for artificer crafting. Missing configuration rejects;
configured zero is distinct from absence. Crafting uses the same immutable relic weights, scoped root and resource
settlement functions as chest rewards. It adds no craft counter or duplicate relic balance.

RegistryDomain owns GuildState: guild definitions keyed by game and founder, membership keyed by game and player,
whitelist entries keyed by game, guild and player, and a private member-count index for deleting an empty guild.
Membership is the sole player fact; the count is not projected. Guild identifiers retain the full founder address. The
former Season membership placeholder is removed. The registry peer extends the nested lifecycle peer layout and requires
the same fresh rehearsal deployment; no live upgrade compatibility is claimed.

Structures appends immutable camp grant entries keyed by game and index, with an optional entry count distinguishing
unconfigured games from a configured empty list. CampResources projects those entries once. Camp balances, Labor
production, guards, occupancy and buildings reuse their existing owning rows; no separate camp status is stored.

Troops appends immutable AgentRules keyed by game and AgentDiscoveryStats containing lifetime discoveries and minted
LORDS units. Current population remains in TroopState and decreases on destruction; lifetime and minted totals never
decrease. Agent ownership stays in the existing map. Creation, travel and displacement share one occupier projection, so
moving an agent cannot turn its tile marker into a realm-owned explorer marker.

EntryAdministration owns the deployment ledger operator in RegistryDomain. Rotation preserves game entitlements and
village passes. SettlementRules no longer copies that operational address into immutable game configuration; this layout
requires the fresh native rehearsal deployment.

MapDomain stores immutable SpireLayout by game. Spire locations are the two layers’ TileOpt occupants; no second
position index or mutable spire count is stored. Initialization creates the complete lattice atomically.

RegistrarState stores immutable preset commitments, series owners and creation counts, and the next game identity.
Registration calldata retains the typed preset definition; game creation verifies the same canonical definition before
applying domain configuration atomically. Series chest economics remain in PrizesDomain. GameRegistry stores only the
final settlement flag; phases derive from its clock, and the unused registration grace field is removed. This layout
requires the fresh native rehearsal deployment.

Troop management reuses ExplorerTroops, Guard and ResourceWeight. Guard occupancy is derived from the four slots instead
of a second count. CombatDomain owns battle calculation and reads the existing immutable season rules; TroopsDomain owns
and writes the resulting armies. Combat authenticates its Troops peer and cannot write another domain's rows. Peers
appends the combat address, requiring the fresh rehearsal deployment.

VillageRaid appends the last successful raid tick to TroopsDomain, keyed by game and village. Combat and raid outcomes
are immutable events; they do not duplicate the current armies or balances in another row. Their event codec requires
the fresh native rehearsal deployment.
