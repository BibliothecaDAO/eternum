import { RelicInfo } from "@bibliothecadao/types";

const formatPercentLabel = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  const isInteger = Number.isInteger(rounded);
  const displayValue = isInteger ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${displayValue}%`;
};

export const formatRelicBonusText = (relic: RelicInfo): string => {
  switch (relic.type) {
    case "Damage": {
      const percent = formatPercentLabel((relic.bonus - 1) * 100);
      return `+${percent} damage dealt`;
    }
    case "Damage Reduction": {
      const percent = formatPercentLabel((1 - relic.bonus) * 100);
      return `-${percent} damage taken`;
    }
    case "Stamina": {
      const percent = formatPercentLabel((relic.bonus - 1) * 100);
      return `+${percent} stamina regeneration`;
    }
    case "Production": {
      const percent = formatPercentLabel((relic.bonus - 1) * 100);
      return `+${percent} production speed`;
    }
    default:
      return relic.effect;
  }
};
