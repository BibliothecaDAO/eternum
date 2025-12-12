export const MARKET_OUTCOME_COLORS = [
  "#5AC8FA",
  "#FF5E57",
  "#FFB800",
  "#34C759",
  "#AF52DE",
  "#FF9500",
  "#5856D6",
  "#FF2D55",
] as const;

export const getOutcomeColor = (index: number) =>
  MARKET_OUTCOME_COLORS[index % MARKET_OUTCOME_COLORS.length];
