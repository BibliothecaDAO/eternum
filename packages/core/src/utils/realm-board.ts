import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

/** The neighbours a building wants, as the realm board rules grant them; empty for boards without bonuses. */
export const boardBonusesFor = (rules: NativeRows["BoardRules"] | undefined, building: number) =>
  (rules?.neighbors ?? [])
    .filter((bonus) => bonus.building === building)
    .map((bonus) => ({
      neighbour: bonus.neighbor,
      productionBps: bonus.production_bps,
      capacityBps: bonus.capacity_bps,
      population: bonus.population,
    }));

export const describeBoardBonus = (bonus: ReturnType<typeof boardBonusesFor>[number]): string =>
  [
    bonus.productionBps > 0 ? `+${bonus.productionBps / 100}% output` : undefined,
    bonus.capacityBps > 0 ? `+${bonus.capacityBps / 100}% capacity` : undefined,
    bonus.population > 0 ? `+${bonus.population} population` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");
