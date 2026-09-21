# Eternum S2 implementation guide

This guide turns the selected Eternum S2 design into an ordered change plan for this repository. It describes the gap
from the code on the PR base, not a second source of game rules. Read the design scope and machine config before using
this map.

## 1. Protect the game-mode boundary first

The factory creates games inside one persistent world and assigns each game an immutable `preset_id`. Eternum and Blitz
therefore share code and storage models even though they use different rules. S2 must be introduced as an Eternum preset
and selected through the existing game/preset boundary.

Current mode and config entry points include:

- `config/source/build-config.ts`, which selects Eternum or Blitz config;
- `config/source/eternum/*.ts`, which defines current long-format values;
- `config/source/blitz/*.ts`, which defines Blitz profiles;
- `packages/types/src/types/common.ts`, whose `Config` interface is the current deployer shape;
- `contracts/l3/game/src/models/config.cairo`, which stores world and preset rows; and
- `contracts/l3/game/src/models/game.cairo`, where a game resolves its preset.

Add an explicit S2 schema/version to the Eternum path. New shared models may be used by Blitz later, but their S2
behaviour must be inactive unless the game's Eternum preset enables it. Add non-regression tests that run existing Blitz
fixtures before changing any shared enum, resource, production or bridge path.

```text
GameRegistry.game_id
        │
        ▼
immutable preset_id ──► mode + schema version
        │
        ├── Eternum S2 ──► selected S2 config and transitions
        └── Blitz ───────► unchanged Blitz config and transitions
```

## 2. Current implementation to S2 target

| Domain               | Current implementation seam                                                                                               | Required S2 change                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config               | `config/source/eternum`, deployer registrar and Cairo preset models cover the current `Config` shape.                     | Compile the selected JSON into a versioned Eternum preset. Add typed rows for every S2 domain, stage/read back all rows, verify a hash and atomically activate one frozen version per season.                                                                                                                                                                                          |
| Labor and Workers    | `ResourcesIds.Labor`, `ResourceLabor`, burn-to-Labor and burn-Labor entrypoints are used by current production.           | Add Workers as an Eternum S2 economic asset with produced entitlement, claims, capacity, freight and action-specific consumption. Disable current Labor conversion paths for S2 without changing Blitz Labor.                                                                                                                                                                          |
| Resource ledger      | `Resource` combines balances and production; `Weight` provides a broad capacity path.                                     | Represent claimed inventory, per-building unclaimed entitlement, escrow and in-transit balances separately. Enforce material, Worker, Donkey and unassigned-troop capacity independently. Research remains uncapped.                                                                                                                                                                   |
| Production           | `systems/production` creates buildings and performs resource/Labor conversion; `use_simple` selects a recipe route.       | Replace S2 conversion production with time-based entitlement and explicit claims. Resource-efficient and Worker-only are T1 construction or claim routes where configured, not generic simple/complex modes.                                                                                                                                                                           |
| Buildings            | Existing categories already cover most producers, `WorkersHut`, Storehouse and troop tiers.                               | Model one slot-free central building per holding, three constructed-building tiers, exact family counts, quadratic repeated-family pricing, instant construction/upgrades and output-identity forfeiture confirmation. Use the player names Keep, Longhouse, Pavilion, Worker's Quarters, Market and Artificer.                                                                        |
| Maintenance          | No complete per-building S2 service state exists.                                                                         | Store `last_serviced_at`, derive Serviced/Worn/Unserviced from holding-specific windows, apply efficiency at claim, and implement the configured recurring recipes. Exempt central buildings, Storehouses and world nodes.                                                                                                                                                             |
| Holdings             | `Structure`, Realm, Village and Camp models already establish categories and ownership seams.                             | Apply the S2 slot, tier, starting-state, production, defence and transfer rules per holding. Realm, Village and Camp captures transfer complete operational state. Add a Village Owner record, six-Village Realm capacity, collection-rarity-weighted one-resource mint selection, unrestricted Owner transfer and immutable parent attachment. Remove Village immunity and rebellion. |
| Logistics            | Donkeys, arrivals and weight-aware transfers exist.                                                                       | Charge one consumed Donkey per 100 kg and one logistics Worker per 1,000 kg, minimum one. Route economic freight for nine seconds per hex. Hyperstructure contributions use their explicit exception.                                                                                                                                                                                  |
| Military             | Troop types, tiers, guards, explorers, stamina, movement, battle and raid systems already exist.                          | Add per-building six-hour training escrow, unassigned troop capacity, configured tier recipes, 1×/3×/9× strength, deployment body limits and complete capture settlement. Disable the raid entrypoints and omit their loot, floor, cooldown and decay state from the Eternum S2 preset without changing Blitz.                                                                         |
| Discovery            | Map exploration already discovers structures and rewards.                                                                 | Apply the ordered resolver and 48-Foundation cap, with no HSF creation on Primary radii 0–35. Preserve other inner discoveries on eligible fog. Initialize the paired Spire lattice, mountain annulus and exact explored-halo unions before placement. Exclude Bitcoin Mines at Ethereal origin.                                                                                       |
| Banks and trade      | Bank, liquidity, swap, trade and capture systems already exist.                                                           | Enforce the single Primary origin Bank for AMM and orderbook routing, preserving global liquidity, selected fees, T2 guards and future controller fee rights. Keep trade remotely accessible and direct transfers separate.                                                                                                                                                            |
| Bridge               | `systems/resources/contracts/resource_bridge_systems.cairo` and bridge utilities handle current deposits and withdrawals. | Enforce the asset matrix and worldwide Hyperstructure efficiency bands in both directions. Add fully prefunded native Fragment liability and Realm-only Satoshi export. Keep currency custody outside the resource-efficiency curve.                                                                                                                                                   |
| Artificer and Relics | Artificer and Relic models/systems already provide the main extension seams.                                              | Implement Research entitlement and claim costs, one optional catalyst stack, fixed Relic price, activation cost, one-active-per-family and direct-transfer-only policy.                                                                                                                                                                                                                |
| Bitcoin Mines        | Bitcoin Mine models, discovery and contribution systems exist and currently use Labor terminology.                        | Convert S2 contribution to Workers→Work, preserve work across capture, settle ten-minute work-weighted phases, reserve storage before accepting work and credit the funded Satoshi reward directly.                                                                                                                                                                                    |
| Faith and Wonders    | Faith, Wonder and prize systems exist.                                                                                    | Apply direct mutable allegiance, future-only point attribution, the 30/70 Owner/follower split, separate ranking and tie pooling. Keep Faith independent of Tribe victory.                                                                                                                                                                                                             |
| Hyperstructures      | Hyperstructure contribution, shares and points systems already exist.                                                     | Implement 15M Fragment initiation, 22 capped resource rows, 1.5M contribution Workers, 880k Share issuance, row-equal completion points, 40/60 continuous VP and capture settlement before control transfer.                                                                                                                                                                           |
| Tribes and prizes    | Current contracts use guild terminology and separate prize distribution seams.                                            | Present the S2 domain as Tribes, persist identity and 1M Shares across seasons, attribute score at earn time, integrate Share-seconds, deterministic close/finalisation and fully funded season claims. Internal migration may adapt current guild storage, but public S2 behaviour and events must be unambiguous.                                                                    |
| Sync and client      | Herald→RECS is the live-state path; the client renders shared modes from that store.                                      | Add every new model/event to manifests and generated bindings, derive UI from RECS, quote with the active config version and implement required capacity, maintenance, forfeiture, partial-delivery and escrow warnings.                                                                                                                                                               |

## 3. Domain state that must be explicit

Do not compress distinct ownership or lifecycle states into one balance. At minimum, the implementation must
distinguish:

```text
production building
  ├── entitlement accrued but unclaimed
  ├── service timestamp and derived maintenance state
  └── active troop-training escrow, where applicable

holding
  ├── owner and authorised operator
  ├── claimed material inventory
  ├── claimed Workers
  ├── claimed Donkeys
  ├── unassigned troops
  ├── buildings and central building
  └── deployed guards / field armies

movement and external settlement
  ├── in-transit freight
  ├── bridge custody and liabilities
  └── persistent prize liabilities
```

This separation prevents overflow burns, double counting during capture and accidental loss when a transaction or
indexer restarts.

### 3.1 Asset conservation

For every asset and transition, tests must reconcile:

```ts
opening + admittedMint + inboundTransfer =
  closing + explicitBurn + outboundTransfer + escrowDelta + transitDelta
```

Unclaimed entitlement is not claimed inventory and should be reconciled in its own ledger. A partial transition may
change only the amount its transition row permits; every unaccepted remainder stays at its source.

### 3.2 Time

Store timestamps or phases that let state be derived deterministically. Do not rely on a client timer for production,
maintenance, training, stamina, travel, Share-seconds or season finalisation. Quotes and execution must use the same
contract clock semantics.

### 3.3 Ownership and capture

Capture is a subsystem settlement, not only an owner-field update. Before changing the owner, settle all time-dependent
accrual and identify which balances, escrows, work orders, guards, Shares and fee rights stay with the structure, move
to the new controller or remain with wallets. The design scope defines those rules by structure type.

For a Village, one `owner` field is the complete authority. The parent Realm Owner pays to mint the Village and becomes
its first owner. Direct transfer or capture atomically replaces that owner, after which the previous owner's sessions
must fail even if they were valid when quoted. Neither path changes `parent_realm_id`; that immutable link continues to
consume one of the parent's six Village slots and routes the 5% bridge-out tax to the parent Realm's current owner.

## 4. One transition contract

Every state-changing S2 entrypoint should follow one shape:

```text
quote exact result
      │
      ▼
admit caller + state + route + inputs + capacity + time
      │
      ▼
apply debit / escrow / permitted partial rule atomically
      │
      ▼
write resulting state and canonical event
      │
      ▼
read back through Herald and RECS
```

The quote should include the config version and enough input state to identify staleness. Contract admission remains
authoritative; the client preview is an explanation, not a prediction layer.

Events must include stable keys, accepted quantities, debits, credits, timer changes, owner changes and config version.
Herald must be able to rebuild the full current state from deployment without querying an alternative live-state source.

## 5. Config compiler and activation

Do not hand-copy the 2,000 parameters or 1,362 recipe components into scattered constants. Build one deterministic
compiler or importer that:

1. parses strings with the declared precision;
2. validates all referenced assets and parameter keys;
3. groups recipe components without losing order;
4. rejects unknown enums, duplicate config keys and missing required rows;
5. emits the relevant contract, client, indexer and operational config from one package version;
6. writes rows in batches of at most 256;
7. reads them back and compares the expected hash; and
8. activates one immutable version for the season.

Generated artifacts may be committed where the existing config pipeline expects them, but the selected JSON remains the
human-reviewable source. A generated file must identify the config schema/version that produced it.

## 6. Implementation sequence

Each slice should close contract, config, events, bindings, client and tests together. Avoid landing dormant mechanics.

1. **Preset and ledger foundation:** mode guard, config version/hash, Worker identity, split capacity and conservation.
2. **Core economy:** central buildings, entitlement, claims, food, ordinary resources, Worker's Quarters and
   maintenance.
3. **Progression:** construction routes, repeated-family pricing, building tiers and holding upgrades.
4. **Logistics:** Markets, Donkeys, freight, arrivals and capacity-aware partial rules.
5. **Military and holdings:** training escrow, troop tiers, deployment limits, stamina, combat, standard capture,
   Village ownership/transfer and removal of Eternum raid paths.
6. **World supply:** discovery resolver, Camps, Rifts, Fragment Mines, Foundations, Spires and layers.
7. **Advanced economy:** Artificer, Research, catalysts, Relics, Banks and bridge custody.
8. **Victory:** Hyperstructure rows/Shares/VP, Tribes, close, finalisation, Share-seconds and prizes.
9. **Parallel contests:** Faith/Wonders and Bitcoin Mines, each behind its own complete Eternum config gate.
10. **Playtest readiness:** telemetry, replay proof, funding admission, operational limits and full client walkthrough.

An implementation slice is not complete when only the contract compiles. It is complete when a player can understand,
submit, observe, replay and test the mechanic through the normal stack.

## 7. Required test matrix

### Mode isolation

- Existing Blitz config snapshots and game flows are unchanged.
- S2-only entrypoints reject a Blitz game even if called directly.
- Worker labels, balances and recipes never replace Labor in a Blitz preset.
- Shared asset IDs and building categories decode correctly in both modes.

### Economy and capacity

- Production stops accruing at each local entitlement cap.
- Claims debit exact inputs and apply maintenance to output only.
- A failed or disallowed partial action changes no balance, timestamp or escrow.
- Each capacity family is enforced independently; overflow is never destroyed silently.
- Worker-only T1 recovery remains possible without a raid-floor subsystem.

### Time and capture

- Serviced, Worn and Unserviced boundary timestamps are exact for Realms and Villages.
- Troops remain escrowed for the full training period and capacity is reserved correctly.
- Capture settles accrued VP, production and work state before ownership changes.
- Village capture transfers complete entity-bound state and changes Owner atomically without changing the parent Realm.
- A Village Owner can perform every Village action, including bridge-out and further ownership transfer.
- A previous Owner cannot execute a quote created before transfer or capture.
- Share ownership never changes merely because a Hyperstructure changes controller.

### External value

- Native Fragment season admission fails unless maximum extraction liability is funded.
- Bridge output uses the correct asset family and worldwide completion band in both directions.
- Satoshi export is Realm-only and has no inbound or fallback mint route.
- Prize activation cannot exceed funded custody; final results cannot be replayed or mutated.

### Sync and recovery

- A clean Herald replay reconstructs every S2 model from world deployment.
- Pre-confirmed state resets cleanly at the confirmed head.
- Indexer lag applies the specified warning and action block thresholds.
- Batched finalisation resumes permissionlessly after interruption without changing ordering or amounts.

## 8. Definition of done for the initial playtest

The build is ready for admission only when:

- all selected runtime config rows are active under one Eternum-only package version and hash;
- every playable transition has contract tests, canonical events, generated bindings and a usable client surface;
- conservation, capacity, capture, scoring and replay invariants pass end to end;
- the complete Blitz regression suite remains green;
- telemetry listed in the design scope is emitted and queryable;
- native Fragment and Bitcoin liabilities are proven funded; and
- any advertised prize has an authorised sponsor, funded vault and immutable result-to-claim path.

Agents do not block this definition because they are deliberately outside the playable baseline. A production launch
decision also remains separate from implementation completion.

## Central Bank implementation ticket

Accepted scope: the [central Bank rules and maps](./banking-explainer.md), applied only to the Eternum S2 preset.

1. Compile the explicit signed axial geometry into the initializer. Remove all six former Bank placements and the origin
   Spire, establish the sole Bank, generate 96 paired Spires and install the full Mountains annulus first.
2. Append the Mountains biome without changing existing serialized biome identifiers. Reject Mountains at the shared
   authoritative movement/path, spawn/deployment, settlement, discovery and Spire-arrival admission boundaries. Apply
   the same rule to every army class, including visually flying mounts. Client pathfinding and rendering must agree.
3. Reveal the union of fixed structure halos and Mountains without reward/discovery rolls; include Ethereal radius-31
   neighbours. Reserve the Ethereal origin before any mine placement. Stage/read back and activate idempotently.
4. Gate all HSF creation at actual Primary radius <=35, retain the existing curve beyond it and continue lower-priority
   discovery checks on otherwise eligible hexes. Recompute exploration denominators from eligible fog.
5. Replace nearest-Bank lookups and validation with the configured central Bank in quotes, swaps, orderbook creation,
   fills and fee settlement. Preserve caller, custody, slippage and capture rules. Do not reseed global AMM liquidity.
6. Ship visible explored Mountains, matching layer coordinates, explored entry halos and an accurate capture route in
   the client. No trade action acquires an army-travel requirement.

Acceptance: the five central-Bank invariant targets in the selected config, plus authoritative regression tests for all
six inner entry paths, denied mountain crossings/landings, no HSF at rings 0/31/32/35, unchanged HSF probability at 36,
allowed Camps/Rifts/Fragment Mines on inner ordinary fog, denied origin Bitcoin Mine and bank fee routing across
capture. Validate concurrent and repeated initialization and preserve Blitz fixtures.

The map validator checks design geometry; it is not evidence that the game contracts implement these rules. The full
Primary explored count depends on holding placement. Remeasure node supply and bank contestability on the new layout.
