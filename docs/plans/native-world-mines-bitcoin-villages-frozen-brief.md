# Mines, Bitcoin mining and villages — frozen native follow-up

Updated 2026-09-12. These gameplay changes remain frozen on Dojo. Implement them in the native world after the
[foundation slice](./native-world-foundation-brief.md), in this order, as separately gated domain commits. They do not
change the old rules used by the slice's parity oracle.

## 1. One mine element, configured kinds

Use Mine in the existing FragmentMine category/occupier slots; do not renumber the stored discriminants or compatible
client projection. Structure metadata carries mine_kind. MineKindConfig is keyed by game_id/kind and specifies resource
type, building category, production rate and cap bounds. Discovery pools are keyed by game_id/layer with per-kind
weights; roll the pool once, then create from the selected kind config. Preserve guard behavior.

Eternum's surface pool includes Essence Rift and Fragment Mine, initially equally weighted. Blitz surface includes
Essence Rift only. Ethereal follows its preset. Fragment Mine preserves existing Eternum production. Preset 1's Essence
Rift has an explicit production rate, initially one quarter of the regular-fast Blitz rate, with the cap unchanged.
Remove the tick-ratio formula: equal tick lengths make it a no-op. Presets 1–3 carry the kind configs.

Use one client label/model table keyed by the structure's kind. Delete the season-mode reward branch and both per-mode
mine label tables in the same item. Ordinary mines reveal no neighbors.

Gate: pool/kind selection and cap-bound tests; no per-mode label table remains; one Eternum harness bot discovers both
surface kinds.

## 2. Bitcoin mining uses global labor and a draw per mine

Any player contributes Labor from any owned structure anywhere on the map. Burn it there; track only game_id, phase,
player and contributed labor. Do not retain the source structure in the contribution model. Delete the per-mine labor
model, ownership restriction on contribution and mine-owner-only client UI. Contribute is available from every owned
structure.

Mines remain discoverable, guarded and capturable. Only owned mines fund lotteries. Discovery or capture in phase N
starts funding from phase N+1. Each funding mine contributes prize_per_phase and draws exactly one winner from the
complete phase contributor pool, weighted by each player's global labor share. A player can win several mines. There is
no no-winner outcome when contributors exist.

Each mine pays 80% to its winner and 20% to its owner, with owner_cut_bps initially 2,000. Ownership and the funding
test use the owner when the permissionless claim executes; there is no ownership-history model. Zero-contributor prizes
roll forward without taking a cut; split them once when awarded. Process claims in batches, with a per-mine, per-phase
claimed record preventing rerolls and duplicate awards. Claimants cannot choose a contributor subset.

The later payout decision supersedes the earlier ERC-20 transfer proposal: use the mock SAT coin representing Bitcoin
sats. Deliver SAT to the winner's owned realm or village closest to the funding mine by hex distance; break ties by
lowest structure id. A winner with no eligible destination forfeits that mine's prize into the next phase. The owner cut
follows the same destination and forfeiture rule for the owner. Phase duration remains explicit configuration; no new
duration is set here.

**Entropy is bound once per phase.** Derive each draw from the bound phase root and mine/phase identity. Claimant, batch
composition, batch order, retries and transaction identity never change it. The same global contributor shares apply to
every mine's draw. Fix the closed phase's contributor pool before generating/publishing its root, using the sequencing
service's replicated binding and failover protocol. Claim retries cannot create fresh phase roots. Claim idempotence,
entropy identity and phase-close publication order must be tested together.

Bitcoin mines reveal their six neighboring biomes on discovery.

Gate: anywhere-contribution, 80/20 split, unowned mines not drawing, next-phase funding after discovery/capture,
weighted per-player draws per mine, batch idempotence, claimant/batch-independent entropy, nearest-destination
selection, lowest-id tie-break, missing-destination forfeiture for both recipients and rollover. In the Ethereal
harness, one bot captures a mine and another contributes from its realm; a phase pays both.

## 3. Villages settle through the planner

Village placement uses the settlement planner with the same call shape as realm placement. Keep
connected_realm_entity_id for the army grant; drop direction. Remove the six-villages-per-realm limit together with the
slots. Production passes bound village count. Dev-mode entry continues skipping the pass and ledger.

Delete StructureVillageSlots, reveal_village_tile, village_directions, the explore_village_coord creation flag, the
Herald pre-session slot reader and slot fields in the sync manifest and entry modal as part of this item.

Gate: village creation through the planner; no slot or per-realm slot-limit reference remains in contracts, core or
client. Realm picking and free-village dev-mode testing follow the native implementation.

## Reveal rule after these three items

- Ordinary mines reveal no neighbors.
- Camp, hyperstructure foundation, bank and Bitcoin mine reveal all six neighbors: biome only, no lottery, no points.
- Realm and village reveal only their own tile.

The original Dojo in-place-upgrade rollout is superseded by the fresh native-world decision. Current games finish on the
old deployment. New native models replace old concepts in their item, including every listed deletion; none is left as a
follow-up. Run each item's own tests/harness gate and applicable `scarb fmt`, `pnpm run format` and `pnpm run knip`
checks. Herald reconstructs native state from confirmed history using the native deployment identity.
