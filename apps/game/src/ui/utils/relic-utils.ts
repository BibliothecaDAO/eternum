import { RelicInfo, formatPercent } from "@bibliothecadao/types";

export const formatRelicBonusText = (relic: RelicInfo): string => {
  switch (relic.type) {
    case "Damage": {
      const percent = formatPercent(relic.bonus - 1);
      return `+${percent} damage dealt`;
    }
    case "Damage Reduction": {
      const percent = formatPercent(1 - relic.bonus);
      return `-${percent} damage taken`;
    }
    case "Stamina": {
      const percent = formatPercent(relic.bonus - 1);
      return `+${percent} stamina regeneration`;
    }
    case "Production": {
      const percent = formatPercent(relic.bonus - 1);
      return `+${percent} production speed`;
    }
    default:
      return relic.effect;
  }
};
