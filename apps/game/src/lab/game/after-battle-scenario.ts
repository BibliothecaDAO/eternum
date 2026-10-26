import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { SITE } from "@/ui/features/frontier/sites/site-fixture";
import { ResourcesIds, StructureType, TileOccupier } from "@bibliothecadao/types";

import type { LabFact, LabScenario } from "./lab-chain";
import { besideOnOpenLand, spireScenario } from "./spire-scenario";

const PRECISION = 1_000_000_000n;
/** The camp the army cleared before the fight. */
const CLEARED_CAMP = 711;
/** How long both stay on battle cooldown after the fight: longer than a session. */
const COOLDOWN_SECONDS = 3_600;

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

/**
 * The owner's army on prod just after its fight (/lab/game?scenario=after-battle): Frontier game 1, 25 October 2026 at
 * 20:53Z, army 0x1703b000000074 attacked the ruin beside it, 4,716 knights against 3,000, and both were left standing,
 * 4,015 against 999, each on its battle cooldown (owner: "I hover the tile but no label ?"). It stood on the tile of
 * the camp it had cleared at 19:43Z (0x1703b000000076, beside the ruin), where only the camp's cleared marker is left.
 * Here realm 7's army is those 4,015 knights on a cleared camp beside a ruin guarded by 999, both on cooldown. The keys are the spire fixture's own for the
 * army's row and the camp it moves away (site-fixture.ts), so each row is rewritten in place.
 */
export const afterBattleScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const armyTile = store.entityOccupancy(1, SPIRE_ARMY)!;
  const ruinTile = besideOnOpenLand(store, armyTile);
  // The map reads a battle's cooldown against the wall clock (getBattleTimerLeft), not the lab's chain clock.
  const cooldownEnd = Math.floor(Date.now() / 1_000) + COOLDOWN_SECONDS;
  const afterTheFight = (count: bigint) => ({
    ...army.troops,
    count: count * PRECISION,
    battle_cooldown_end: cooldownEnd,
  });
  store.applyFacts([
    { model: "ExplorerTroops", key: "0x74", value: wire({ ...army, troops: afterTheFight(4_015n) }) },
    ...ruinAt(store, ruinTile, afterTheFight(999n)),
    clearedCampAt(armyTile),
  ] as never);
  return spire;
};

/** The camp the army cleared, on the tile it stands on: the site's row with its receipt, as clear_site leaves it. */
const clearedCampAt = (tile: { col: number; row: number }): LabFact => ({
  model: "ExpeditionSite",
  key: "0x1ab96",
  value: wire({
    game_id: 1,
    entity_id: CLEARED_CAMP,
    category: StructureType.Camp,
    initial_guard_count: 1_600n * PRECISION,
    alt: false,
    col: tile.col,
    row: tile.row,
    clear: {
      explorer_id: SPIRE_ARMY,
      home_id: 7,
      reward: { resource_type: ResourcesIds.Essence, amount: 4_800n * PRECISION },
    },
  }),
});

/** A ruin on the tile, guarded by the troops given: its structure, its site, its guard and its tile's blocker. */
const ruinAt = (
  store: ReturnType<typeof spireScenario>["store"],
  tile: { col: number; row: number },
  guard: object,
): LabFact[] => [
  {
    model: "Structure",
    key: "0x71",
    value: wire({
      ...store.require("Structure", { game_id: 1, entity_id: 7 }),
      entity_id: SITE,
      owner: 0,
      base: {
        category: StructureType.Ruin,
        level: 0,
        created_at: 1,
        troop_max_guard_count: 1,
        troop_max_explorer_count: 0,
        starting_troops_granted: true,
      },
    }),
  },
  {
    model: "ExpeditionSite",
    key: "0x72",
    value: wire({
      game_id: 1,
      entity_id: SITE,
      category: StructureType.Ruin,
      initial_guard_count: 3_000n * PRECISION,
      alt: false,
      ...tile,
      clear: null,
    }),
  },
  {
    model: "Guard",
    key: "0x73",
    value: wire({ game_id: 1, structure_id: SITE, slot: 0, troops: guard, destroyed_tick: 0 }),
  },
  {
    model: "TileOccupancy",
    key: "0x1ab95",
    value: { game_id: 1, alt: false, ...tile, entity_id: SITE, category: TileOccupier.Ruin, is_structure: true },
  },
];
