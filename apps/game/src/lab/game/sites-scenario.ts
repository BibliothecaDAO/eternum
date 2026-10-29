import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { TileOccupier } from "@bibliothecadao/types";

import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { type LabCommand, type LabFact, type LabScenario, wire } from "./lab-chain";
import { armySpent, armyProgress, besideOnOpenLand, PROGRESS_KEYS, spireScenario } from "./spire-scenario";

/**
 * The army's stamina and XP as it reaches the sites: a Well's 60 fits under its bar, and a Shrine's XP takes it past
 * the price of its first tier.
 */
const STAMINA = 40n;
const XP = 40;

/**
 * The spire's army with a Well and a Shrine on open land beside it (/lab/game?scenario=sites): select it and tap
 * either, and its card offers Use. Its bar is part spent and it holds some XP, so what a use gives it shows.
 */
export const sitesScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({
        ...army,
        troops: { ...army.troops, stamina: { Inline: { amount: STAMINA, settled_at: spire.startsAt, remainder: 0 } } },
      }),
    },
    armyProgress(PROGRESS_KEYS.spireArmy, SPIRE_ARMY, XP),
  ] as never);
  const stands = store.entityOccupancy(1, SPIRE_ARMY)!;
  for (const [index, category] of [TileOccupier.Well, TileOccupier.Shrine].entries()) {
    const tile = besideOnOpenLand(store, stands);
    store.applyFacts([
      {
        model: "TileOccupancy",
        key: `0x1af0${index}`,
        value: { game_id: 1, alt: false, ...tile, entity_id: 951 + index, category, is_structure: false },
      },
    ] as never);
  }
  return {
    ...spire,
    answer: (command, chain, now) =>
      command.kind === "InteractSite" ? answerSiteUse(command, chain, now) : spire.answer(command, chain, now),
  };
};

/** What stands on a tile with no structure (a Shrine, a Well, a chest), as its occupancy row. */
export const siteAt = (
  key: string,
  tile: { col: number; row: number },
  entity: number,
  category: TileOccupier,
): LabFact => ({
  model: "TileOccupancy",
  key,
  value: { game_id: 1, alt: false, col: tile.col, row: tile.row, entity_id: entity, category, is_structure: false },
});

const WELL_STAMINA = 60;
/** InteractSite: [explorer, coord.alt, coord.x, coord.y]. */
const answerSiteUse = (command: LabCommand, chain: NativeFactStore, now: number): LabFact[] => {
  const [explorerId, , x, y] = command.calldata.slice(5).map((felt) => BigInt(felt));
  const [siteKey, site] = [...chain.entries("TileOccupancy")].find(
    ([, row]) => BigInt(row.col) === x && BigInt(row.row) === y,
  )!;
  const vacated: LabFact = { model: "TileOccupancy", key: siteKey, value: null };
  if (site.category === TileOccupier.Shrine) return [vacated, shrineXp(chain, explorerId)];
  return [vacated, wellStamina(chain, explorerId, now)];
};

const shrineXp = (chain: NativeFactStore, explorerId: bigint): LabFact => {
  const [key, progress] = [...chain.entries("ArmyProgress")].find(([, row]) => row.explorer_id === explorerId)!;
  const fixed = chain.require("ArmyProgressionRules", { game_id: 1 }).fixed_xp;
  return { model: "ArmyProgress", key, value: wire({ ...progress, xp: progress.xp + fixed }) };
};

/** A Well's stamina, held to the army's bar as grant_stamina clamps it. */
const wellStamina = (chain: NativeFactStore, explorerId: bigint, now: number): LabFact => {
  const army = chain.require("ExplorerTroops", { game_id: 1, explorer_id: explorerId });
  const maximum = chain.require("SliceRules", { game_id: 1 }).troop_stamina_config.stamina_knight_max;
  const held = Number((army.troops.stamina as { Inline: { amount: bigint } }).Inline.amount);
  return armySpent(chain, explorerId, -Math.min(WELL_STAMINA, maximum - held), now);
};
