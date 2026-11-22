import { frontierSeasonOnePreset as preset } from "../../../../../../../config/source/frontier/season-one";

import { nativeResearchConstants as research, nativeStructureConstants } from "@bibliothecadao/eternum/game-client";

import { frontierBaseConfig } from "../../../../../../../config/source/frontier/base";
import { ResourcesIds } from "@bibliothecadao/types";
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
): RealmResearchFacts => ({
    castleLevel,
    essence,
    labor,
    standing,
    learned,
    price,
    board: {
      outputStepBps: preset.board.outputStepBps,
      populationStepBps: preset.board.populationStepBps,
      rationStep: preset.board.rationStep,
      wheatPerTroop: Number(frontierBaseConfig.resources!.productionBySimpleRecipe![ResourcesIds.Knight]![0]!.amount),
      troopsPerHour: preset.balance.resources.productionByComplexRecipeOutputs[ResourcesIds.Knight] * 3600,
      staminaBar: preset.balance.troop.stamina.staminaKnightMax,
    },
  laborStore: (level) => nativeStructureConstants.LABOR_STORES[level]!,
});

/** The owner's realm on 20 October: a Settlement, nothing researched, short of everything. */
export const EARLY_REALM = realmOn(0, 300, 718, { [research.ROW_FARM]: 2, [research.ROW_HUT]: 1 }, {});

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
    [research.ROW_FARM]: { tier: 1 },
    [research.ROW_WORKSHOP]: { tier: 1 },
    [research.ROW_HUT]: { tier: 1 },
    [research.ROW_SUPPLY_YARD]: { tier: 1 },
    [research.ROW_LORE]: { tier: research.LORE_SHRINES },
  },
);

export const EARLY_ARMY: ArmyView = {
  name: "Army 1",
  art: "knight-t1",
  troops: 1_500,
  stamina: { current: 4, max: 120, perExplore: 20 },
  secondsToFull: 4 * 3_600,
  revealYield: 75,
};

export const VETERAN_ARMY: ArmyView = {
  name: "Army 2",
  art: "knight-t1",
  troops: 1_240,
  stamina: { current: 96, max: 120, perExplore: 20 },
  secondsToFull: 2 * 3_600,
  revealYield: 120,
};
