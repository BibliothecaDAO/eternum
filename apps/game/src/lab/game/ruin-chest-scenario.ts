import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import { ruinAt } from "./after-battle-scenario";
import type { LabFact, LabScenario } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The ruin's guard, which the army beats, and the troops the army loses beating it. */
const GUARD = 50n;
const LOST = 4n;
/** The ruin's chest: the contract's tier 1 (uncommon) and the LORDS it pays. */
const CHEST_TIER = 1;
const CHEST_LORDS = 100n;
const HOME = 7;

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * The spire's army beside a weakly guarded ruin holding an uncommon chest (/lab/game?scenario=ruin-chest): select the
 * army, tap the ruin, Attack. The lab chain answers the attack as the contract clears a ruin (the guard falls, the
 * clear's LORDS on the site, the army's losses) and streams its payout story and battle as Herald does, so the game
 * plays the clear and opens the ruin's chest at the centre of the screen. Reload for another.
 */
export const ruinChestScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const ruinTile = besideOnOpenLand(store, store.entityOccupancy(1, SPIRE_ARMY)!);
  store.applyFacts([
    ...ruinAt(store, ruinTile, { ...army.troops, count: GUARD * PRECISION }),
    {
      model: "SiteChest",
      key: "0x76",
      value: { game_id: 1, entity_id: SITE, tier: CHEST_TIER, amount: String(CHEST_LORDS), reservation_day: "0" },
    },
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "BattleGuard" && command.fields.defender_id === String(SITE)
        ? clearTheRuin(chain, now, ruinTile)
        : spire.answer(command, chain, now),
  };
};

/** The ruin cleared as the contract leaves it, with the payout story and the battle Herald streams for it. */
const clearTheRuin = (chain: LabScenario["store"], now: number, tile: { col: number; row: number }): LabFact[] => {
  const [armyKey, army] = rowOf(chain, "ExplorerTroops", (row) => row.explorer_id === BigInt(SPIRE_ARMY));
  const [siteKey, site] = rowOf(chain, "ExpeditionSite", (row) => row.entity_id === BigInt(SITE));
  const [structureKey] = rowOf(chain, "Structure", (row) => row.entity_id === BigInt(SITE));
  const [guardKey] = rowOf(chain, "Guard", (row) => row.structure_id === BigInt(SITE));
  const before = army.troops.count;
  const after = before - LOST * PRECISION;
  const reward = { resource_type: ResourcesIds.Lords, amount: CHEST_LORDS * PRECISION };
  const position = (event_index: number) => ({
    block_number: now,
    transaction_hash: `0x1ae${now.toString(16)}`,
    transaction_index: 0,
    event_index,
  });
  return [
    { model: "Structure", key: structureKey, value: null },
    { model: "Guard", key: guardKey, value: null },
    {
      model: "ExpeditionSite",
      key: siteKey,
      value: wire({ ...site, clear: { explorer_id: SPIRE_ARMY, home_id: HOME, reward } }),
    },
    { model: "ExplorerTroops", key: armyKey, value: wire({ ...army, troops: { ...army.troops, count: after } }) },
    {
      model: "StoryEvent",
      key: `0x1ae${now.toString(16)}4`,
      value: wire({
        game_id: 1,
        owner: "0x111",
        timestamp: now,
        event_position: position(4),
        story: {
          SitePayout: {
            structure_id: HOME,
            explorer_id: SPIRE_ARMY,
            site_id: SITE,
            category: StructureType.Ruin,
            reward,
          },
        },
      }),
    },
    {
      model: "BattleEvent",
      key: `0x1ae${now.toString(16)}5`,
      // As the contract emits it (troops.cairo): each side's player, troops and counts before and after.
      value: wire({
        version: 1,
        game_id: 1,
        attacker_id: SPIRE_ARMY,
        defender_id: SITE,
        attacker_owner: HOME,
        defender_owner: 0,
        winner_id: SPIRE_ARMY,
        coord: { x: tile.col, y: tile.row },
        max_reward: [],
        attacker: { player: "0x111", category: army.troops.category, tier: army.troops.tier, before, after, roll: 0 },
        defender: {
          player: "0x0",
          category: army.troops.category,
          tier: army.troops.tier,
          before: GUARD * PRECISION,
          after: 0n,
          roll: 0,
        },
        timestamp: now,
        event_position: position(5),
      }),
    },
  ];
};

/** A row of the chain's with the key the chain holds it by, which an answer rewrites in place. */
const rowOf = <Model extends "ExplorerTroops" | "ExpeditionSite" | "Structure" | "Guard">(
  chain: LabScenario["store"],
  model: Model,
  matches: (row: NativeRows[Model]) => boolean,
): [string, NativeRows[Model]] => {
  const found = [...chain.entries(model)].find(([, row]) => matches(row as NativeRows[Model]));
  if (!found) throw new Error(`The lab chain holds no ${model} for the ruin's clear`);
  return found as [string, NativeRows[Model]];
};
