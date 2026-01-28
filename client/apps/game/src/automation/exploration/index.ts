import type { ExplorationStrategy, ExplorationStrategyId } from "./types";
import { basicFrontierStrategy } from "./strategies/basic-frontier";

const STRATEGIES: Record<ExplorationStrategyId, ExplorationStrategy> = {
  "basic-frontier": basicFrontierStrategy,
};

export const EXPLORATION_STRATEGIES = Object.values(STRATEGIES);

export const getExplorationStrategy = (id: ExplorationStrategyId | null | undefined): ExplorationStrategy => {
  if (id && STRATEGIES[id]) {
    return STRATEGIES[id];
  }
  return basicFrontierStrategy;
};
