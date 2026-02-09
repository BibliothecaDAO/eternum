import type { ActionPath } from "@bibliothecadao/eternum";
import type { BiomeType, HexEntityInfo, HexPosition } from "@bibliothecadao/types";

export type ExplorationStrategyId = "basic-frontier";

export type ExplorationMapSnapshot = {
  position: HexPosition;
  exploredTiles: Map<number, Map<number, BiomeType>>;
  structureHexes: Map<number, Map<number, HexEntityInfo>>;
  armyHexes: Map<number, Map<number, HexEntityInfo>>;
  questHexes: Map<number, Map<number, HexEntityInfo>>;
  chestHexes: Map<number, Map<number, HexEntityInfo>>;
};

export type ExplorationStrategyContext = ExplorationMapSnapshot & {
  explorerId: number;
  actionPaths: Map<string, ActionPath[]>;
};

export type ExplorationStrategySelection = {
  path: ActionPath[];
  reason: string;
};

export type ExplorationStrategy = {
  id: ExplorationStrategyId;
  label: string;
  selectNextAction: (context: ExplorationStrategyContext) => ExplorationStrategySelection | null;
};
