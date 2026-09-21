# Eternum S2 — comprehensive initial-playtest design scope

**Baseline:** selected initial-playtest configuration

**Audience:** gameplay, client, contract, indexer, simulation, QA and AI implementation teams

**Status:** implementation scope; not a statement of deployment, prize funding or launch authorisation

**Last reconciled:** 22 September 2026

## 1. What this document controls

Eternum is a strategy game played on a shared hex world. Each player begins with a Realm: a settlement that can produce
resources, build an army, trade with other players and compete for control of structures on the map. Players can also
control Villages and Camps. These player-controlled settlements are collectively called **holdings**.

The immediate objective is not simply to accumulate materials. Players use their holdings to explore, fight, capture
valuable world structures and build Hyperstructures. Hyperstructures generate Victory Points (VP) for both their
controller and their shareholders. Those points belong to Tribes, which are persistent player organisations. Once a
Tribe reaches the victory target, an eligible Tribe Owner may close the season; the highest-scoring Tribe at that moment
wins.

This document explains that complete playable model from the beginning and then records the implementation boundaries
that hold it together. Exact machine-readable values are stored in `config/initial-playtest.json`. That file contains
the selected parameter set, the complete recipe ledger, asset rules and state transitions. Implementations should
consume or generate from it rather than manually transcribing recipe tables.

The central constraint is **Workers**. Workers represent available labour. Producing food, collecting resources,
constructing buildings, maintaining them, transporting goods, training armies, conducting research and building
Hyperstructures all draw from the same finite supply. A player can pursue several strategies, but cannot fund every
useful action at once.

## 2. The season in one flow

```text
Enter with a Realm + defensive army
        │
        ▼
Claim Workers and food ──► choose early buildings ──► service them to protect output
        │                         │
        │                         ├──► construction materials ──► upgrades / trade / Hyperstructures
        │                         ├──► transport capacity ──────► long-range freight
        │                         ├──► troops ──────────────► explore / raid / capture
        │                         └──► Research ────────────► Relics
        │
        ▼
Explore fog ──► discover and capture valuable world structures
        │
        ▼
Build Hyperstructures ──► earn Victory Points through control and ownership
        │
        ▼
Eligible Tribe Owner closes ──► score freezes ──► 7-day exit ──► prizes settle
```

The opening is about establishing a reliable supply of Workers, Wheat and Fish. Expansion adds resource production,
storage and transport. Armies then turn economic strength into exploration, defence, raiding and control of the world.
The endgame converts that control and a Tribe's shared economy into Hyperstructures and Victory Points.

This is not a linear technology tree. A player can trade, specialise, raid, supply allies or pursue world structures.
The shared constraint is opportunity cost: spending Workers on one route makes another route slower.

## 3. Holdings and progression

A holding is a place the player controls and manages. It owns buildings, claimed inventory, unclaimed production, troop
capacity and local state. There are three holding types: Realms, Villages and Camps.

Every holding has one indestructible **central building** that does not use a buildable slot and never needs
maintenance:

- a Realm's central building is called the **Keep**;
- a Village's central building is called the **Longhouse**; and
- a Camp's central building is called the **Pavilion**.

These names describe the same structural role. A central building provides the holding's base storage and capacity. The
Keep and Longhouse also produce free Workers; the Pavilion does not.

Constructed buildings and troops use three strength or development tiers. Tier 1 (T1) is the opening tier, Tier 2 (T2)
becomes available at City and Tier 3 (T3) becomes available at Kingdom. Camps are limited to T1.

### 3.1 Realms

A Realm is the player's primary settlement and can be conquered. Capture transfers everything that belongs to the Realm
in the game—its buildings, claimed inventory, unclaimed production and deployed armies. The attacker cannot select only
the valuable parts.

Every Realm begins as a Settlement. Upgrading it to City, Kingdom and then Empire opens more building slots and raises
the maximum strength of armies that may be deployed from it.

| Realm tier | Buildable slots | Maximum deployed army strength | Role                                      |
| ---------- | --------------: | -----------------------------: | ----------------------------------------- |
| Settlement |               6 |                          6,000 | opening economy and local defence         |
| City       |              18 |                         30,000 | specialised production and first upgrades |
| Kingdom    |              36 |                         90,000 | regional military and logistics hub       |
| Empire     |              60 |                        180,000 | mature strategic base                     |

Settlement upgrades complete immediately once the full recipe is paid. There is no build timer. The practical gate is
accumulating, storing and moving the inputs.

| Upgrade           | Holdings         | Required recipe                                                                                                                                |
| ----------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Settlement → City | Realm or Village | 99k Wood, 72k Stone, 36k Coal, 360k Wheat, 360k Fish, 8k Workers                                                                               |
| City → Kingdom    | Realm only       | 198k Hartwood; 99k each of Ironwood, Cold Iron, Gold, Copper, Silver and Obsidian; 990k Wheat, 990k Fish, 22k Workers                          |
| Kingdom → Empire  | Realm only       | 396k Hartwood; 198k each of Deep Crystal, Diamonds, Sapphire and Ruby; 165k Ignium; 129k Ethereal Silica; 1.98M Wheat, 1.98M Fish, 65k Workers |

**First-season context:** the four-tier Realm ladder and 6/18/36/60 slot progression remain recognisable. S2 changes the
economy underneath it: Workers replace Labor, maintenance can suppress output, storage is split by asset family and a
captured Realm transfers its complete operational state.

### 3.2 Villages

A Village is attached to a parent Realm. Creating one costs USD 5 in USDC, a dollar-denominated token. That payment is
converted in the same transaction to LORDS, Eternum's ecosystem token. If conversion fails, the Village is not created
and no fee is collected.

A Village produces one of the 22 construction materials at 50% of the equivalent Realm rate and can grow only to City.
It cannot be conquered directly. Its controller cannot import troops from another holding, so Village defence and
rebellion must use troops produced in that Village.

A Village may rebel by attacking its own parent Realm. If the Village controller wins, they capture the parent Realm,
keep the Village and preserve the attachment between them. Ordinary Realm capture rules apply to the captured Realm.
Village maintenance windows are twice the Realm windows, recognising their slower supporting role.

When a Village exports an eligible asset from the game to a player's external wallet, the request passes through its
parent Realm and pays 5% to the parent Realm Owner's external wallet. This export gateway is called the bridge and is
explained in Chapter 11. Villages can transfer locally and participate in the economy, but they are not miniature
independent Realms.

### 3.3 Camps

Camps are small wallet-linked outposts with six buildable slots. They start empty, and their Pavilion produces no
Workers. A Camp can construct only Tier 1 Worker's Quarters, Farms, Fisheries, Markets and Storehouses. It cannot build
resource, military or Artificer buildings; upgrade buildings; use a Bank; or bridge assets.

Camps have no Worker or food raid floors. They provide a light forward base rather than a second full economy. Camps can
be captured; everything that belongs to the Camp transfers with it.

### 3.4 Starting state

Donkeys are consumable freight capacity: each one can carry 100 kg when a shipment is dispatched. They are explained
with logistics in Chapter 10. Deployed troops are already assigned to defence; unassigned troops remain in local
inventory and can be organised later.

| Holding | Workers |   Wheat |    Fish | Donkeys | Deployed Tier 1 defenders | Unassigned Tier 1 troops | Base material capacity |
| ------- | ------: | ------: | ------: | ------: | ------------------------: | -----------------------: | ---------------------: |
| Realm   |   6,000 | 120,000 | 120,000 |     600 |                     5,900 |                      100 |             180,000 kg |
| Village |   3,000 |  60,000 |  60,000 |     100 |                       900 |                      100 |             180,000 kg |
| Camp    |       0 |       0 |       0 |       0 |                         0 |                        0 |             180,000 kg |

Every Realm and Village begins with one of the three troop classes: Crossbowmen, Knights or Paladins. The class is
matched to the local terrain type, or biome, that gives it a combat bonus. Most starting troops are already deployed as
defenders; 100 remain unassigned in local troop inventory. This gives a defensible opening without granting a fully
flexible offensive army.

## 4. Workers: the operating constraint

Nearly every economic action needs Workers. A Worker is one unit of available labour, not a persistent character with an
identity. Holdings produce Workers over time; the player claims them into storage and then spends them to perform work.
A spent Worker is consumed.

Workers are local and cannot enter or leave the game through the bridge. They occupy Worker capacity, weigh 1 kg when
transported, can move between holdings and can be raided above protected floors. This makes labour a supply chain: the
player must produce it, store it and place it where the work will happen.

### 4.1 Worker sources

| Source                               |                       Rate |    Local unclaimed cap |            Worker capacity |
| ------------------------------------ | -------------------------: | ---------------------: | -------------------------: |
| Keep — Realm central building        |                   120/hour |                  1,440 |                      6,000 |
| Longhouse — Village central building |                    60/hour |                  1,440 |                      6,000 |
| Pavilion — Camp central building     |                          0 |                      0 |                      6,000 |
| Worker's Quarters T1/T2/T3           | 120 / 360 / 1,080 per hour | 1,440 / 4,320 / 12,960 | +6,000 / +18,000 / +54,000 |

The Keep and Longhouse claims are free. A Worker's Quarters claim consumes **12.5 Wheat and 12.5 Fish for each Worker**.
Claims may be partial, but each submitted claim is all-or-nothing: the game never silently burns an input or overflows
storage.

The economy deliberately produces fewer Workers than would be needed to perform every useful action at once. Players
must decide whether current labour goes to collecting output, expanding, maintaining buildings, transporting goods,
training armies or pursuing the endgame.

**First-season change:** Labor was manufactured from resources and used as a simple recipe substitute. Workers are not
renamed Labor. They are produced over time, claimed into bounded storage, moved, protected, raided and consumed by
specific work.

### 4.2 Protected floors

A raid cannot take every Worker or every unit of food from a Realm or Village. The protected floor is the amount that
remains available for basic recovery after the raid resolves.

| Holding | Workers |  Wheat |   Fish |
| ------- | ------: | -----: | -----: |
| Realm   |   3,000 | 60,000 | 60,000 |
| Village |   1,500 | 30,000 | 30,000 |
| Camp    |       0 |      0 |      0 |

Raids take only from claimed inventory above these floors. Floors preserve a recovery path but do not protect ordinary
resources, Fragments or other raidable assets.

### 4.3 What the economy contains

Wheat and Fish are food. Twenty-two ordinary construction materials support buildings, maintenance, armies and
Hyperstructures. Essence comes from world Rifts and supports advanced troops, Research and Relics. Ancient Fragments
come from finite Mines and initiate Hyperstructures. Research is a local settlement balance used to create Relics.
Donkeys carry freight, while LORDS is the external ecosystem token used for fees, markets and prizes.

These asset families do not all follow the same storage, transfer, raid or bridge rules. Chapter 9 lists those
boundaries before the guide moves into logistics and trading.

## 5. Production, entitlement and claims

Production does not appear directly in a holding's inventory. Instead, each production building fills a local buffer
over time. The amount waiting in that buffer is called **unclaimed entitlement**.

The claim step makes production an active economic decision. The player chooses how much to collect, pays the relevant
Workers and other inputs, and needs enough destination capacity. Only then does the output become **claimed inventory**
that can be spent, traded or moved. Unclaimed entitlement belongs to its building, cannot be transferred or bridged, and
stops growing when its buffer is full.

```ts
accrued = min(localCap, previous + ratePerSecond * elapsed);
claimable = min(requested, accrued, inputAffordable, destinationCapacity);
output = floor(claimable * maintenanceEfficiency);
```

As introduced with holdings, constructed buildings use T1, T2 and T3. A holding must be a Settlement for T1, a City for
T2 and a Kingdom for T3. For most producers, the tier multiplies output by 1× / 3× / 9×.

Farms, Fisheries and ordinary Resource Buildings produce 3,600 / 10,800 / 32,400 units per hour at T1/T2/T3, with
twelve-hour caps of 43,200 / 129,600 / 388,800. Claiming either food or an ordinary resource consumes 6 Workers per
1,000 units.

Each Realm is assigned a set of the 22 construction materials that it may produce. A Village is assigned one material
when it is created. This specialisation is why trade and conquest matter: no single holding is expected to produce every
material it needs.

Claim actions must show:

- accrued entitlement;
- the selected claim amount;
- all input costs;
- effective output after maintenance;
- destination capacity and any limiting factor.

If the complete selected claim cannot succeed, it reverts without consuming inputs.

## 6. Buildings, construction and repeated families

The constructible roster is:

- Farm and Fishery for food;
- Worker's Quarters for Workers;
- ordinary Resource Buildings;
- Market for Donkeys;
- Storehouse for material capacity;
- Artificer for Research and Relics;
- Archery Range, Barracks and Stables for Crossbowmen, Knights and Paladins.

Despite its name, a Market building produces Donkeys; players trade resources at World Banks. A Storehouse expands
material storage but produces no resource of its own.

T1 construction generally offers two routes:

1. **Resource-efficient:** ordinary resources plus a smaller Worker input.
2. **Worker-only fallback:** a deliberately expensive Worker payment that prevents a hard bootstrap deadlock.

T2 and T3 upgrades do not have a Worker-only route. Mature progression therefore requires a functioning resource
economy.

Construction and upgrades complete as soon as their full recipes are paid. When an upgrade changes what a building
produces—such as a military building moving from T1 to T2 troops—the player should claim the old entitlement first. Any
remaining old output is forfeited only after explicit confirmation.

Farm and Fishery are special: their T1 construction is Worker-only at 1,200 Workers. Representative initial-playtest T1
recipes are:

| Building          | Resource-efficient route                                                   | Worker-only route |
| ----------------- | -------------------------------------------------------------------------- | ----------------: |
| Worker's Quarters | 26k Wood, 21k Stone, 21k Coal, 200 Workers                                 |     3,600 Workers |
| Market            | 40k Wood, 26k Copper, 26k Silver, 26k Obsidian, 200 Workers                |     7,200 Workers |
| Storehouse        | 34k Wood, 29k Stone, 32k Coal, 200 Workers                                 |     4,800 Workers |
| Artificer         | 60k Wood, 37k Ironwood, 34k Cold Iron, 33k Gold, 22k Essence, 400 Workers  |    15,000 Workers |
| Archery Range     | 126k Wood, 107k Stone, 105k Coal, 48k Ironwood, 51k Silver, 400 Workers    |    24,000 Workers |
| Barracks          | 126k Wood, 107k Stone, 105k Coal, 34k Cold Iron, 71k Obsidian, 400 Workers |    24,000 Workers |
| Stables           | 126k Wood, 107k Stone, 105k Coal, 87k Copper, 28k Gold, 400 Workers        |    24,000 Workers |

Exact upgrade, maintenance, node-specific and resource-building recipes are in `config/initial-playtest.json`.

Building another member of the same family increases cost quadratically:

```ts
familyMultiplier = 1 + 0.2 * existingFamilyCount ** 2;
price = roundByAssetRule(basePrice * familyMultiplier);
```

The first building is base price; the second is 1.2×; the third is 1.8×; the fourth is 2.8×. Family count is evaluated
before construction and applies to every priced component.

## 7. Maintenance

Constructed buildings need periodic **maintenance** to keep working at full efficiency. Maintenance is a recurring
recipe paid by the holding that owns the building. A successful payment resets that building's service timer.

The feature gives every developed economy an ongoing cost. A player who builds more production must also decide which
buildings are worth servicing. Missing maintenance does not destroy the building or erase its stored entitlement; it
reduces the amount received when that entitlement is claimed and eventually stops useful claims altogether.

| Realm building state | Time since service         | Effective production/claim |
| -------------------- | -------------------------- | -------------------------: |
| Serviced             | 0–48 hours                 |                       100% |
| Worn                 | over 48 to under 120 hours |                        75% |
| Unserviced           | 120 hours or more          |                         0% |

Village windows are 0–96 hours, 96–240 hours and 240+ hours. Maintenance cannot be prepaid. Keep, Longhouse, Pavilion,
Storehouse and resource nodes found on the world map are maintenance-exempt.

Maintenance cost is based on the building's total configured construction investment: its original T1 recipe plus any
fixed T2 and T3 upgrade recipes. It does not use the player's escalated repeat-building price or the current market
price. The recurring resource fractions are 2% / 1.44% / 1.16% at T1/T2/T3. A Worker-only maintenance route exists, but
costs roughly 2.5× the weighted equivalent efficient route.

Production entitlement keeps accruing while a building is worn or unserviced, up to its local cap. Efficiency is applied
when the player claims. Maintaining first is therefore economically important: a worn claim pays full inputs for 75%
output; an unserviced claim pays for zero and should be blocked or strongly warned in the client.

## 8. Storage and overflow

Storage is split into material, Worker, troop and Donkey capacity. Research is uncapped. Separate capacity families
prevent an army or Worker stock from silently displacing materials.

| Capacity source                |         T1 |         T2 |           T3 |
| ------------------------------ | ---------: | ---------: | -----------: |
| Storehouse material grant      | 180,000 kg | 540,000 kg | 1,620,000 kg |
| Worker's Quarters Worker grant |      6,000 |     18,000 |       54,000 |
| Market Donkey grant            |      6,000 |     18,000 |       54,000 |
| Military building troop grant  |      6,000 |      6,000 |        6,000 |

No successful action may silently burn overflow. The contract must either admit a partial action where the transition
explicitly permits it or revert atomically. The client should calculate the same maximum admissible quantity before
submission.

## 9. Resources and special assets

There are 22 ordinary construction resources: Adamantine, Alchemical Silver, Coal, Cold Iron, Copper, Deep Crystal,
Diamonds, Dragonhide, Ethereal Silica, Gold, Hartwood, Ignium, Ironwood, Mithral, Obsidian, Ruby, Sapphire, Silver,
Stone, True Ice, Twilight Quartz and Wood.

Those materials support construction, upgrades, maintenance, troop production, Research catalysts and Hyperstructures.
Rarity differs, but rare materials are not automatically more useful in every recipe. A specialist holding gains value
by supplying what other players cannot produce locally.

The wider asset set also includes Wheat, Fish, Workers, Donkeys, troops, Essence, Ancient Fragments, Research, Relics,
LORDS, Tribe Shares, Hyperstructure Shares and Satoshis.

Important boundaries:

- **Workers:** local economic work; non-bridgeable.
- **Essence:** world-derived upgrade/research asset; non-bridgeable.
- **Ancient Fragments:** finite Mine output and Hyperstructure initiation asset; native production is fully prefunded
  and may bridge out.
- **Research:** settlement balance; uncapped and non-bridgeable.
- **Relics:** transferable directly between players, non-bridgeable and excluded from automated Bank markets.
- **LORDS:** the ecosystem token used for market settlement, fees and prizes; held in segregated external custody.
- **Satoshis:** Bitcoin Mine reward; outbound through Realm only, no inbound bridge.

One unit of an ordinary resource weighs 1 kg. Fragments weigh 0.1 kg. Workers weigh 1 kg for transport and storage
accounting.

## 10. Logistics and Donkeys

Donkeys represent freight capacity. They are produced by Markets at 120 / 360 / 1,080 per hour. Claiming one Donkey
costs 2 Wheat, and one Worker can claim five Donkeys.

Each dispatched Donkey carries 100 kg and is consumed when the shipment leaves. Economic freight also consumes logistics
Workers:

```ts
donkeys = ceil(payloadMassKg / 100);
logisticsWorkers = max(1, ceil(payloadMassKg / 1_000));
travelSeconds = routeHexes * 9;
```

Food is not an extra dispatch cost. Hyperstructure contributions are a deliberate exception: they consume 10 Workers per
1,000 resource units but bypass Donkeys and ordinary freight timing.

Transfers must be physically routed. Raided loot sits with the deployed army, has a 10 kg per surviving troop capacity
and must return or transfer before it becomes settlement inventory.

## 11. Trade, Banks and bridges

The **bridge** is the gateway between in-game balances and a player's external wallet. The **World Banks** are the
in-game trading venues. These are separate systems: a Bank swaps one asset for another inside the economy, while the
bridge moves an eligible asset into or out of the game.

One World Bank at Primary (0,0) routes AMM and orderbook trades from every Realm and Village. It replaces the six
regional Banks and the central Spire. Trading remains remotely accessible under the existing holding permissions; armies
make the journey to capture and defend the Bank. The Bank begins with three T2 guard armies, one per troop class. All
eligible controller fees accrue through this single objective. Global liquidity, fee rates and historical balances
retain their existing rules. The complete [Banking explainer and maps](./banking-explainer.md) show the approach.

Each Bank is an automated market: its two reserves price a swap using the constant-product rule `x*y=k`. The Bank
controller receives 2.5% of the LORDS value traded and the protocol receives another 2.5%. Direct player-to-player
transfers bypass the market.

Banks are capturable. Capture transfers control and future fee rights, not historical balances.

Bridge permissions are explicit per asset. Ordinary resources, food, Ancient Fragments, troops and Donkeys can bridge in
and out. Workers, Essence, Research, Relics and unclaimed production cannot. Satoshis are outbound-only.

| Completed Hyperstructures | Ordinary resources, food, Fragments and Donkeys | Troops |
| ------------------------: | ----------------------------------------------: | -----: |
|                         0 |                                             25% |     0% |
|                       1–2 |                                             50% |    25% |
|                       3–5 |                                             70% |    50% |
|                       6–8 |                                             85% |    70% |
|                      9–11 |                                             95% |    85% |
|                12 or more |                                             95% |    95% |

The milestone uses the worldwide number of completed Hyperstructures, so every completion improves the bridge for
everyone. Efficiency is applied in both directions. If a player bridges 1,000 Wood at 50% efficiency, 500 Wood arrives
at the destination. Currency uses segregated custody and does not use this resource-efficiency curve.

Native Fragment production is fully prefunded before the season. A player may therefore extract native Fragments from
the game through the bridge, after applying the current Hyperstructure efficiency. This backing requirement is an
admission condition for the season, not a balance supplied by player deposits.

## 12. Military production

Archery Ranges produce Crossbowmen, Barracks produce Knights and Stables produce Paladins. Training is a claim from
accumulated troop entitlement, not an instant shop purchase. A military building can have one active batch; its inputs
remain in escrow for six hours before the troops are credited.

Troop tiers have 1× / 3× / 9× strength. T2 and T3 recipes recursively consume two lower-tier troops and cost 8 / 24
Essence per new troop. This keeps the three classes economically comparable while preserving class behaviour.

| Troop       | T1 resource-efficient cost per troop                      | T1 Worker-only cost            | T2 additional cost per troop                                                       | T3 additional cost per troop                                                       |
| ----------- | --------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Crossbowman | 1 Worker, 0.4 Wheat, 0.4 Fish, 5.5 Ironwood, 10 Silver    | 5 Workers, 0.4 Wheat, 0.4 Fish | 2 T1, 2 Workers, 8 Essence, 0.6 Wheat/Fish, 3.45 Deep Crystal, 3 Ruby              | 2 T2, 4 Workers, 24 Essence, 0.8 Wheat/Fish, 4.7 Adamantine, 4.4 Alchemical Silver |
| Knight      | 1 Worker, 0.3 Wheat, 0.5 Fish, 5 Cold Iron, 12.3 Obsidian | 5 Workers, 0.3 Wheat, 0.5 Fish | 2 T1, 2 Workers, 8 Essence, 0.4 Wheat, 0.8 Fish, 4.9 Diamonds, 3.1 Ethereal Silica | 2 T2, 4 Workers, 24 Essence, 0.5 Wheat, 1.1 Fish, 3.9 Mithral, 5.1 Twilight Quartz |
| Paladin     | 1 Worker, 0.5 Wheat, 0.3 Fish, 15.5 Copper, 4.5 Gold      | 5 Workers, 0.5 Wheat, 0.3 Fish | 2 T1, 2 Workers, 8 Essence, 0.8 Wheat, 0.4 Fish, 2.9 Ignium, 3 Sapphire            | 2 T2, 4 Workers, 24 Essence, 1.1 Wheat, 0.5 Fish, 3 Dragonhide, 6 True Ice         |

Claimed troops remain **unassigned** in the holding until they are placed into a guard or field army. Deployed and guard
troops no longer occupy the holding's unassigned troop capacity.

The number of bodies that may be deployed is constrained by the holding's strength cap and troop tier:

```ts
maxBodies = floor((deploymentStrength * tierModifier) / tierStrength);
tierModifier = { T1: 0.5, T2: 1.0, T3: 1.5 };
```

Higher-tier troops are stronger but do not translate every strength point into equal battlefield bodies.

## 13. Movement, exploration and combat

The world begins mostly hidden by fog. An army reveals unknown hexes by exploring them. Moving through a known hex costs
1 Fish per troop; exploring an unknown hex also costs 1 Fish per troop, but uses more stamina. Stamina is an army's
action energy: movement, exploration and combat spend it, and time restores it up to the maximum.

| Action                          |  Stamina |
| ------------------------------- | -------: |
| Move one hex                    |       20 |
| Explore one hex                 |       30 |
| Attack                          |       50 |
| Defend                          |       40 |
| Regeneration per 60-second tick |       30 |
| Initial / maximum               | 30 / 120 |

Home-biome advantage is 30%. Combat uses deterministic damage-reduction rules with class and situation modifiers.
Crossbowmen operate at 70% against armies and 30% against structures; Knights operate at 85% when guarding and 115%
against structures. Defenders still recovering from a recent action take an 85% damage multiplier; exhausted defenders
take 70%.

Combat losses are resolved before an eligible capture. Villages cannot be conquered. Realms, Camps, Banks,
Hyperstructures and other world structures each transfer the state defined for that structure. For example, capturing a
Hyperstructure changes control and future control VP but never confiscates Shares owned by player wallets.

## 14. Raiding and recovery

The first raid takes 20% of eligible claimed inventory above protected floors and destroys 10% of unassigned claimed
troops. Further raids against the same holding within 24 hours multiply the loot fraction by 50% each time, globally
across attackers.

```ts
eligible = max(0, claimed - protectedFloor);
lootFraction = 0.2 * 0.5 ** priorRaidsInWindow;
loot = min(attackerCapacity, floor(eligible * lootFraction));
```

Workers, Wheat and Fish floors preserve the ability to rebuild. The worker-only T1 construction route is the second half
of that recovery design: it prevents missing local construction materials from becoming a permanent lockout.

## 15. World structure supply

The **Primary layer** holds settlements, ordinary exploration and most world structures. The **Ethereal layer** is
reached through Spires and contains Bitcoin Mines. Both are hex maps; distance, access and the ability to defend a route
matter as much as aggregate world supply.

The Primary capacity model contains 736,561 hexes. Its former 28,928-pre-explored assumption must be recomputed against
the new layout and actual holding placements; it is not a launch count. The fixed Bank/Spire halos and mountain range
reveal 1,483 unique Primary hexes before holding-specific reveals. Model exploration assumptions of 12.5% by day 7, 25%
by day 14, 50% by day 28 and 75% by day 42 remain planning assumptions, not forced player milestones. Earlier node
supply projections below require remeasurement against the revised eligible fog before they can validate this layout.

When one explored hex is eligible for several discoveries, the game resolves them in order: Hyperstructure Foundation,
Fragment Mine, Essence Rift, Bitcoin Mine, then Camp. The first successful result occupies that discovery. There are 48
discoverable Hyperstructure Foundations on the Primary layer. HSF discovery and all Foundation creation are prohibited
at Primary radii 0–35 inclusive. Outside that exclusion, retain the existing distance and depletion calculation using
actual distance from the origin, without rebasing at radius 36. On ordinary eligible inner fog, Camps, Essence Rifts and
Fragment Mines remain discoverable. Mountains and initialisation reveals never run discovery lotteries. Agents are
deferred to the other development team and are not discovered or played in this scope.

### 15.1 Essence Rifts

- discovery anchor: 1 in 125 eligible discoveries;
- output: 1 Essence/second;
- local unclaimed cap: 86,400;
- extraction: 10 Workers per 1,000 Essence;
- Essence cannot bridge.

The model expects 4,168 Rifts discovered and 2,084 controlled by day 56, delivering roughly 4.84B Essence under its 50%
control and 80% delivery assumptions. Aggregate supply is abundant; local access remains strategically scarce.

### 15.2 Fragment Mines

- discovery chance by distance from map centre: 0.2% at the centre and at radius 360, peaking at 1% around radius 240;
- reserve tiers: 300k / 600k / 900k / 1.2M / 1.5M, equally weighted;
- output: 1 Fragment/second until reserve exhaustion;
- local unclaimed cap: 86,400;
- extraction: 10 Workers per 1,000 Fragments.

The same model expects about 2,461 Mines discovered, 1,230 controlled and 1.10B Fragments delivered. Reserves are
finite. Mine count, capture, collection frequency and Worker allocation all matter. Every native Fragment is backed for
bridge redemption before the season begins.

### 15.3 Spires and layers

There are 96 paired Spire locations: six inner corners on Realm ring 2, plus the six-spaced outer lattice on Realm rings
6, 12, 18, 24 and 30. Their Primary radii are 30, 90, 180, 270, 360 and 450; matching Ethereal radii are 2, 6, 12, 18,
24 and 30. Multiply signed Ethereal axial coordinates by 15 to obtain the Primary counterparts. Neither origin has a
Spire. Realm placement starts at Realm ring 3, Primary radius 45.

Every Primary hex on inclusive radii 32–35 is Mountains: four hex rings, 804 hexes, all pre-explored, impassable and
unspawnable. Armies enter the Ethereal layer at an outer Spire, approach an inner ring-2 Spire and cross back to Primary
radius 30. The Bank is then 30 hexes away measured centre to centre. A crossing may require battle; ordinary movement,
arrival placement and combat determine the actual journey. No unit presentation, route batching or teleport landing may
bypass the mountain restriction.

Initialisation reveals the Bank, every Spire and all six neighbours on Primary; every Spire and all six neighbours on
Ethereal; and the entire mountain range. Ethereal (0,0) is vacant, explored and explicitly barred from Bitcoin Mine
spawning. Halos are unions, include outer neighbours beyond the Spire extent, and reveal without discovery rewards. The
full Ethereal reveal set contains 667 hexes, extending to radius 31. Its unchanged radius-24 Bitcoin probability core
contains 1,801 hexes: 403 explored and 1,398 unexplored. Extending the transport lattice does not extend the mining
probability core or change its existing outer decay. See the [maps and expedition walkthrough](./banking-explainer.md).

## 16. Artificers, Research and Relics

An Artificer accrues Research entitlement without inputs. Claiming converts entitlement into settlement Research.

| Tier | Research/hour | 12-hour cap | Worker claim cost/hour | Essence claim cost/hour |
| ---- | ------------: | ----------: | ---------------------: | ----------------------: |
| T1   |            60 |         720 |                     24 |                     240 |
| T2   |           180 |       2,160 |                     72 |                     720 |
| T3   |           540 |       6,480 |                    216 |                   2,160 |

The atomic claim unit is 10 Research and costs 4 Workers plus 40 Essence. Maintenance efficiency applies to output, not
inputs.

While serviced, a claim may include one fixed 3,600-unit ordinary-resource catalyst stack. The bonus depends on resource
rarity, from 0.25% to 25% of nominal Research, rounded down. It is one stack per transaction, so batching a twelve-hour
buffer is materially more efficient than twelve one-hour claims.

A Relic costs 50,000 Research. One active Relic is allowed per family. Lesser and Greater Relics cost 5,000 / 10,000
Essence to activate and can grant 20% / 40% Worker-production bonuses. Timed Relics last 360 phases, or 60 real hours.
Relics transfer directly between players only.

## 17. Bitcoin Mines

Bitcoin Mines exist on the Ethereal layer. Workers committed to mining become Work one-for-one and are consumed when the
phase settles. Each ten-minute worked phase selects one Mine through a work-weighted draw and credits 9,920 Satoshis
directly to the winning Mine.

There is one active work order per Mine. Work stays with the Mine across capture; the new controller can change future
orders. The game accepts new work only when the Mine has enough free storage for a possible reward, so settlement cannot
burn the reward or fail for lack of room. The initial playtest funds 100,000,000 Satoshis and reserves 80% for emission.

Satoshis can be raided, do not use Donkey routes and can bridge out through a Realm only. There is no inbound bridge and
no generic mint fallback.

## 18. Faith and Wonders

Faith is a parallel contest over allegiance rather than materials. A Wonder is a special world structure that acts as
the focus of one Faith. Realms and Villages generate Faith Points for the Wonder they follow. A holding may change
allegiance directly; the change affects future points and never rewrites points already earned. There are no chains of
subservience—a holding follows a Wonder, not another follower.

Owning a Wonder gives the player a share of the Faith produced by its followers, which creates a social and military
reason to contest Wonders. Faith has its own ranked prize. It does not change the main Tribe score and consumes no core
economic resources in the initial playtest.

- Realm: 1 Faith Point/second.
- Village: 0.1 Faith Point/second.
- Wonder: 10 Faith Points/second.
- Wonder Owner receives 30% of aggregate emission; holding owners receive 70%.
- Subservience is direct, reversible and affects future emission only; there are no chains.
- Camps do not generate Faith.
- The top five Faith ranks split their separate pool 40% / 25% / 15% / 12% / 8%.

Rewards associated with Wonder ownership are calculated when Faith Points are claimed. The Wonder Owner cannot blacklist
or remove followers. Faith closes at the main game close timestamp and does not alter the main Tribe winner. Exact ties
pool the prize allocations for the ranks occupied by the tied players and split that pooled amount evenly.

## 19. Hyperstructures and victory

A **Hyperstructure Foundation** is a discoverable world site where a Hyperstructure can be built. A player must control
the Foundation before initiating it, and the initiator pays 15M Ancient Fragments. After initiation, any wallet may
contribute. Completion requires 150M ordinary resources across all 22 resource rows and 1.5M contribution Workers.

Contributions are public and can never exceed the amount still required in a row. They bypass ordinary Donkey freight,
but still consume 10 contribution Workers per 1,000 resource units. This makes a Hyperstructure a shared economic
project even when armies are fighting over its control.

The displayed 880,000 Hyperstructure Shares comprise 220,000 initiator Shares plus a separate 30,000-Share pool for each
of the 22 completed resource rows. Each row's pool is divided in proportion to accepted contributions to that row. A
resource with a small requirement therefore has the same Share budget as a resource with a large requirement. The
initiator may also earn contributor Shares by supplying resources. Shares are season-bound wallet property.

Each completed Hyperstructure grants 3,000,000 Victory Points and then emits 6 VP per second. Completion points use the
same 22 equal row pools and are divided within each row by accepted contribution; initiation alone does not earn
completion points.

```ts
controlVP = elapsedSeconds * 6 * 0.4;
shareVP = elapsedSeconds * 6 * 0.6 * walletShareFraction;
```

The controller and shareholders earn different parts of the same stream. For example, if one Tribe controls the
structure and another Tribe's wallets own every Share, the controller's Tribe receives 40% of future emission while
those Share holders' Tribes receive 60%.

Capture first assigns every Victory Point earned up to that moment, then transfers future control and leaves Shares with
their wallets. A Share transfer affects only future accrual.

The victory target is **21,000,000 Tribe Victory Points**. The season has no automatic deadline; the 56-day balance
horizon is a modelling window, not a forced close.

Any Owner of a Tribe that has reached 21,000,000 points may close the season. That caller does not automatically win.
Close freezes play and score, then the highest-scoring Tribe wins; an exact tie goes to the lower persistent Tribe ID. A
168-hour transfer, trade and bridge window follows.

## 20. Persistent Tribes and prizes

Tribes persist across seasons and have 1,000,000 Shares. Membership and Share ownership are independent. Initial Shares
go to the Tribe Owner. The official Tribe market charges 2.5% for liquidity providers and 2.5% for the protocol; the
Hyperstructure Share market charges 2.5% for the initiator and 2.5% for the protocol.

Tribe score is season state. Score is permanently attributed to the wallet's Tribe at the moment it is earned; moving to
another Tribe later does not move old score. A wallet without a Tribe still increases its personal season counter but
creates no Tribe score, and joining later does not apply that score retroactively.

Tribe Shares persist, but prize entitlement uses season-only **Share-seconds**: the number of Shares a wallet held
multiplied by how long it held them during the season. For example, holding 100 Shares for ten seconds contributes 1,000
Share-seconds. The count ends when the final season result is verified. Membership and Share ownership are independent,
and making a Tribe private does not change Share rights. The top ten Tribe allocations are:

| Rank | Prize pool |
| ---: | ---------: |
|    1 |        30% |
|    2 |        18% |
|    3 |        12% |
|    4 |         9% |
|    5 |         7% |
|    6 |         6% |
|  7–8 |    5% each |
| 9–10 |    4% each |

A new Tribe targets a fixed USD 25 formation fee, paid in USDC and atomically converted to LORDS at execution. A failed
conversion creates no Tribe and collects no fee.

Share holders have 30 days to claim after prize activation. An unclaimed allocation recycles to the next-ranked Tribe
prize reserve.

The LORDS prize must be fully funded before it is advertised. Sponsor selection and deployed vault evidence are
production admission gates, not numbers to fake in a client fixture. Protocol revenue from configured fees is split 50%
to the Treasury and 50% to holders of vote-escrowed LORDS (veLORDS).

## 21. Where game state lives

Moment-to-moment season play runs on a fast execution layer, referred to technically as L3. Long-lived ownership and
financial settlement live on Starknet. The boundary matters because the final season result must move from fast game
state into persistent prize state without either side disagreeing about the winner.

```text
Fast season execution (L3)               Starknet persistent state
────────────────                         ─────────────────────────
settlements, inventories                 Tribe identity and Shares
armies, world control                    prize vault and claims
production, maintenance                  authenticated final result
Hyperstructure control and Shares        bridge custody / external assets
season score and close  ──commit result──► payout liabilities
```

The final result must be deterministic, authenticated and immutable before prize activation. Finalisation is
permissionless and cursor-batched so it cannot depend on a single privileged transaction fitting in one block.

No S2 mechanic burns LORDS. Fees and funded prizes create demand, revenue and redistribution, not artificial token
destruction.

## 22. What changed from Eternum's first season

This table is additional context for returning players and developers. The rest of this document does not require
knowledge of the first season.

| Earlier-season concept                                   | S2 rule                                                                              | Consequence                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Labor as a non-bridgeable simple-mode input              | Finite produced and claimed Workers                                                  | Work becomes local, storable, movable, raidable and strategically scarce.        |
| Standard vs Simple production recipes                    | Resource-efficient vs Worker-only T1 recovery routes                                 | Worker-only is a bootstrap fallback, not a universal mature recipe.              |
| Direct production inventory                              | Local entitlement then atomic claim                                                  | Collection timing, maintenance and capacity are explicit.                        |
| Buildings operate indefinitely                           | Serviced / Worn / Unserviced maintenance states                                      | Neglected production slows then stops without deleting the building.             |
| Broad storage assumptions                                | Separate material, Worker, troop and Donkey capacities                               | No silent cross-family overflow or burn.                                         |
| Realm/Village core holdings                              | Adds capturable Camps                                                                | Forward presence can exist without duplicating a full Realm economy.             |
| One-tier troop emphasis                                  | T1/T2/T3 at 1×/3×/9× strength                                                        | Upgrades consume lower tiers and Essence; body count remains constrained.        |
| Hyperstructure completion as a primarily structural goal | Public 22-resource build, Control/Share Victory Point streams and fixed-target close | Ownership, funding and conquest have distinct economic meanings.                 |
| Seasonal guild framing                                   | Persistent Tribe Shares with season Share-seconds                                    | Long-lived ownership and current-season contribution coexist.                    |
| World Banks and bridge curve                             | Capturable Banks, explicit asset matrix and prefunded native Fragment redemption     | Hyperstructure progress improves movement between the game and external economy. |
| Fragment Mines and Hyperstructure Foundations            | Finite geographic Mines, staged discovery and 15M initiation                         | World exploration and collection determine strategic Fragment supply.            |

## 23. Implementation contracts

Every state-changing action needs the same five guarantees:

1. **Quote:** expose exact debits, credits, timers, capacity effect and current authority.
2. **Admission:** check ownership, state, route, capacity, inputs and relevant cooldown together.
3. **Atomicity:** either apply the declared partial rule or revert without hidden consumption.
4. **Event:** emit enough canonical data for the indexer to reconstruct the transition.
5. **Read-back:** expose the resulting state and config version so client and simulation can verify it.

The active config must be versioned and hash-verifiable. All required rows are written and read back before activation;
activation is an atomic marker. Clients must display the config version used for quotes and warn if it changes before
submission.

### 23.1 Configuration and season start

Gameplay rows are staged in batches of at most 256 and checked against the expected hash. One `config ready` commit
activates the complete version; a partly written version can never become playable. The version then freezes for the
season.

`config/initial-playtest.json` is the complete selected configuration. It has already absorbed the final design
decisions and excludes superseded values, design history and deferred Agent rows. Implement it as one authority; do not
attempt to merge it with an earlier config package.

The season bootstrap must also prove that external liabilities are funded: native Fragment redemption, the Bitcoin
reward reserve and any advertised LORDS prize. Funding a vault is not a substitute for activating the matching config,
and activating a config is not proof of funding.

### 23.2 Accounts, sessions and automation

A controller session is a temporary wallet permission used to submit approved game actions without asking for the main
wallet signature every time. It lasts 24 hours and warns the player one hour before expiry. One all-or-nothing
controller batch can contain at most 16 calls. Producer claims and maintenance are enabled in the default policy;
transfers, swaps, bridging, Share trading, season close and prize claims require explicit permission.

Wallet-approved automation may choose when and how much to claim, maintain or trade within those permissions. This is
account convenience, not the deferred Agent game system. It never changes production rates, bypasses recipes, ignores
capacity or gains information unavailable to the player.

### 23.3 Client behaviour

The client is responsible for explanation before signature, not only transaction submission.

| Situation                                     | Required client behaviour                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Quote older than 10 minutes                   | Refresh before submission.                                                                     |
| Capacity or local buffer reaches 80%          | Warn and show the limiting capacity.                                                           |
| Realm building reaches 44 hours since service | Warn before it becomes Worn at 48 hours.                                                       |
| Worn claim                                    | Show the 75% output and require confirmation.                                                  |
| Unserviced claim                              | Block it.                                                                                      |
| Upgrade changes output identity               | Show unclaimed entitlement and offer `claim first`; forfeiture requires explicit confirmation. |
| Partial delivery caused by capacity           | Show delivered and retained amounts and require confirmation.                                  |
| Troop training                                | Always show the six-hour escrow.                                                               |

### 23.4 Indexing and replay

The indexer—the service that reconstructs readable game state from events—is part of the game contract because every
inventory, timer, score and ownership view depends on it. The player interface warns at 30 seconds of lag and blocks
sensitive actions at 120 seconds. Replay begins at world deployment, retains 120 days of history, reconciles the most
recent 64 blocks and must conserve 100% of accepted asset state.

### 23.5 Transaction limits

One transaction may contain at most 32 calls, 16 gameplay actions, eight claim rows, eight delivery rows, 16 maintenance
rows or all 22 Hyperstructure contribution rows. Final result materialisation advances permissionlessly in batches of 64
positions. These limits shape client batching; they must not change the economic result.

Priority implementation slices:

1. asset ledger and split capacity families;
2. entitlement, partial claim and maintenance state machine;
3. Worker, food and ordinary-resource production;
4. construction, repeated-family escalation and settlement upgrades;
5. freight, Donkeys and transfers;
6. military escrow, movement, combat, raid and capture;
7. world discovery and node extraction;
8. Artificer, catalyst and Relic lifecycle;
9. Banks, bridge permissions and custody;
10. Hyperstructure contribution, Shares, scoring and close;
11. persistent Tribe result and funded prize settlement;
12. Faith/Wonders and Bitcoin Mines as separately testable systems.

## 24. Acceptance and telemetry

The initial playtest should capture, at minimum:

- Worker production, missed claims, claim-food coverage and Worker allocation by action;
- entitlement lost to cap, claim batch sizes and claims made while worn;
- time to City, Kingdom and Empire by player segment;
- recipe route selection and repeated-family counts;
- Donkey production, route lengths, freight failures and stranded loot;
- explored hexes, node discoveries, control, local buffer saturation and extraction;
- Essence spending by sink and Fragment use/import/export/backing;
- troop class/tier production, combat, raids, captures and protected-floor recovery;
- Foundation initiation, contribution timing, Hyperstructure completion, capture and Share transfer;
- score attribution, close eligibility, finalisation progress and prize liabilities.

Model outputs are not live promises. The initial-playtest model reaches a funded Empire around day 6.5 and the
Worker-only recovery route around day 13.5 under aggregate assumptions. Telemetry must decide whether those trajectories
survive real spatial access, player behaviour, market liquidity and competition.

## 25. Scope boundaries and launch admission

- **Agents:** deferred to the other development team. Agent discovery, classes, messaging and custody are not part of
  the playable baseline and are absent from the selected machine config.
- **Production prize:** do not advertise until an authorised sponsor and fully funded deployed vault exist.
- **Launch/deployment:** this scope authorises implementation work against the initial-playtest baseline, not a
  production deploy or external financial action.

All other mechanic and numeric questions should begin with the selected machine configuration. A disagreement should
produce a reviewed successor decision, not an undocumented code override.
