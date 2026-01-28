const MARKET_OUTCOME_COLORS = [
  "#F4B547", // order-power (gold)
  "#EB544D", // order-giants (muted red)
  "#706DFF", // order-skill (blue-purple)
  "#139757", // order-detection (forest green)
  "#D47230", // order-fox (burnt orange)
  "#00A2AA", // order-reflection (teal)
  "#8E35FF", // order-perfection (purple)
  "#C74800", // order-rage (dark rust)
] as const;

export const getOutcomeColor = (index: number) => MARKET_OUTCOME_COLORS[index % MARKET_OUTCOME_COLORS.length];
