import { basicFrontierStrategy } from "./strategies/basic-frontier";
import type { ExplorationStrategy, ExplorationStrategyId } from "./types";

const STRATEGIES: Record<ExplorationStrategyId, ExplorationStrategy> = {
  "basic-frontier": basicFrontierStrategy,
};

export const getExplorationStrategy = (id: ExplorationStrategyId | null | undefined): ExplorationStrategy => {
  if (id && STRATEGIES[id]) {
    return STRATEGIES[id];
  }
  return basicFrontierStrategy;
};
