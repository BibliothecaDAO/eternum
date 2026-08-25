import { PlayerRelicsData } from "@bibliothecadao/torii";

const hasPositiveAmount = (value: unknown): boolean => {
  if (typeof value === "bigint") {
    return value > 0n;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    if (value.trim() === "") {
      return false;
    }

    try {
      return BigInt(value) > 0n;
    } catch {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) && numericValue > 0;
    }
  }

  return false;
};

export const countAvailableRelics = (relicsData?: PlayerRelicsData | null): number => {
  if (!relicsData) {
    return 0;
  }

  const countRelics = (
    entities: Array<{ relics?: Array<{ amount?: number | string | bigint }> }> | undefined,
  ): number => {
    if (!entities) {
      return 0;
    }

    return entities.reduce((total, entity) => {
      const relics = entity.relics ?? [];
      const availableRelics = relics.filter((relic) => hasPositiveAmount(relic?.amount));
      return total + availableRelics.length;
    }, 0);
  };

  return countRelics(relicsData.structures) + countRelics(relicsData.armies);
};
