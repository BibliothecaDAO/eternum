import { RELICS, RelicInfo, ResourcesIds } from "@bibliothecadao/types";

export interface RelicBonusSummary {
  damageMultiplier: number;
  damageBonusPercent: number;
  damageRelic?: RelicInfo;
  damageReductionMultiplier: number;
  damageReductionPercent: number;
  damageReductionRelic?: RelicInfo;
  staminaMultiplier: number;
  staminaBonusPercent: number;
  staminaRelic?: RelicInfo;
}

const roundPercent = (value: number) => Math.round(value);

const getRelicsByIds = (relicIds: ResourcesIds[]) => RELICS.filter((relic) => relicIds.includes(relic.id));

export const getRelicBonusSummary = (relicIds: ResourcesIds[]): RelicBonusSummary => {
  const relevantRelics = getRelicsByIds(relicIds);

  const damageRelics = relevantRelics.filter((relic) => relic.type === "Damage");
  const damageRelic = damageRelics.reduce<RelicInfo | undefined>((best, current) => {
    if (!best) return current;
    return current.bonus > best.bonus ? current : best;
  }, undefined);

  const damageReductionRelics = relevantRelics.filter((relic) => relic.type === "Damage Reduction");
  const damageReductionRelic = damageReductionRelics.reduce<RelicInfo | undefined>((best, current) => {
    if (!best) return current;
    return current.bonus < best.bonus ? current : best;
  }, undefined);

  const staminaRelics = relevantRelics.filter((relic) => relic.type === "Stamina");
  const staminaRelic = staminaRelics.reduce<RelicInfo | undefined>((best, current) => {
    if (!best) return current;
    return current.bonus > best.bonus ? current : best;
  }, undefined);

  const damageMultiplier = damageRelic?.bonus ?? 1;
  const damageReductionMultiplier = damageReductionRelic?.bonus ?? 1;
  const staminaMultiplier = staminaRelic?.bonus ?? 1;

  return {
    damageMultiplier,
    damageBonusPercent: damageMultiplier !== 1 ? roundPercent((damageMultiplier - 1) * 100) : 0,
    damageRelic,
    damageReductionMultiplier,
    damageReductionPercent: damageReductionMultiplier !== 1 ? roundPercent((1 - damageReductionMultiplier) * 100) : 0,
    damageReductionRelic,
    staminaMultiplier,
    staminaBonusPercent: staminaMultiplier !== 1 ? roundPercent((staminaMultiplier - 1) * 100) : 0,
    staminaRelic,
  };
};

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
