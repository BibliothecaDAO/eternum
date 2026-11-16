import { frontierSeasonOnePreset as preset } from "../../../../../../../config/source/frontier/season-one";
import { WELL_REFILL_PERCENT } from "@bibliothecadao/eternum/troop-stamina";

import { nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";

import type { ArmyView } from "../army/army-detail";
import type { RealmResearchFacts } from "./research-tree";

const price = (row: number, tier: number) => {
  const entry = preset.research.find((candidate) => candidate.row === row && candidate.tier === tier);
  if (!entry) throw new Error(`Missing research price ${row}/${tier}`);
  return { essence: entry.essenceCost, labor: entry.laborCost };
};

/** A realm on the preset: its level, what it holds, what stands, what it learned. */
const realmOn = (
  castleLevel: number,
  essence: number,
  labor: number,
  standing: Partial<Record<number, number>>,
  learned: RealmResearchFacts["learned"],
): RealmResearchFacts => {
  const storeroomPicks = (learned[research.ROW_WORKSHOP]?.sides ?? []).filter((side) => side === 1).length;
  return {
    castleLevel,
    essence,
    labor,
    standing,
    learned,
    price,
    board: {
      outputStepBps: preset.board.outputStepBps,
      storageStepBps: preset.board.storageStepBps,
      populationStepBps: preset.board.populationStepBps,
    },
    laborStore: (level) =>
      (preset.board.resourceStoreCaps[level]! * (10_000 + storeroomPicks * preset.board.storageStepBps)) / 10_000,
    wellRefillPercent: WELL_REFILL_PERCENT,
  };
};

/** The owner's realm on 20 October: a Settlement, nothing researched, short of everything. */
export const EARLY_REALM = realmOn(0, 300, 718, { [research.ROW_FARM]: 2, [research.ROW_HUT]: 1 }, {});

/**
 * Some days in, a City: Farm uncommon on both sides (Fields, Granary), Workshop uncommon (Tools), Barracks with Charge II, a Hut
 * uncommon, a War hall and a Scouts' lodge standing (the lodge uncommon on rifts), the Shrine learned.
 */
export const MID_REALM = realmOn(
  1,
  18_250,
  9_640,
  {
    [research.ROW_FARM]: 4,
    [research.ROW_WORKSHOP]: 2,
    [research.ROW_HUT]: 3,
    [research.ROW_SUPPLY_YARD]: 1,
  },
  {
    [research.ROW_FARM]: { tier: 1, sides: [0, 1] },
    [research.ROW_WORKSHOP]: { tier: 1, sides: [0] },
    [research.ROW_HUT]: { tier: 1, sides: [] },
    [research.ROW_SUPPLY_YARD]: { tier: 1, sides: [] },
    [research.ROW_SHRINE]: { tier: 1, sides: [] },
  },
);

/** The owner's Army 1: 1,500 troops, 12 XP, 4 of 120 stamina, every attribute common. */
export const EARLY_ARMY: ArmyView = {
  name: "Army 1",
  art: "knight-t1",
  troops: 1_500,
  stamina: { current: 4, max: 120, perExplore: 20 },
  secondsToFull: 4 * 3_600,
  revealYield: 75,
};

/** A veteran: 260 XP after a few clears, Battle II, Logistics III (170 stamina), Scouting II on rifts. */
export const VETERAN_ARMY: ArmyView = {
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  stamina: { current: 96, max: 120, perExplore: 20 },
  secondsToFull: 2 * 3_600,
  revealYield: 120,
};
