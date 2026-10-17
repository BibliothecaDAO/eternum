import type { IncomingTroopArrival } from "@bibliothecadao/eternum";
import { getBattleTimerLeft } from "../utils/combat-directions";

const serializeIncomingTroopArrivals = (incomingTroopArrivals?: IncomingTroopArrival[]): string =>
  incomingTroopArrivals
    ?.map((arrival) => `${arrival.resourceId}:${arrival.troopTier}:${arrival.count}:${arrival.arrivesAt.toString()}`)
    .join(",") ?? "";

export const filterPendingIncomingTroopArrivals = (
  incomingTroopArrivals: IncomingTroopArrival[] | undefined,
  nowSeconds: number,
): IncomingTroopArrival[] => (incomingTroopArrivals ?? []).filter((arrival) => Number(arrival.arrivesAt) > nowSeconds);

export const resolveStructureIncomingTroopArrivals = (input: {
  currentIncomingTroopArrivals?: IncomingTroopArrival[];
  nextIncomingTroopArrivals?: IncomingTroopArrival[];
  nowSeconds: number;
}): { changed: boolean; incomingTroopArrivals?: IncomingTroopArrival[] } => {
  const filteredIncomingTroopArrivals = filterPendingIncomingTroopArrivals(
    input.nextIncomingTroopArrivals,
    input.nowSeconds,
  );
  const previousKey = serializeIncomingTroopArrivals(input.currentIncomingTroopArrivals);
  const nextKey = serializeIncomingTroopArrivals(filteredIncomingTroopArrivals);

  return {
    changed: previousKey !== nextKey,
    incomingTroopArrivals: filteredIncomingTroopArrivals.length > 0 ? filteredIncomingTroopArrivals : undefined,
  };
};

export const shouldTrackTimedStructureLabel = (input: {
  battleCooldownEnd?: number;
  incomingTroopArrivals?: IncomingTroopArrival[];
  nowSeconds: number;
}): boolean =>
  getBattleTimerLeft(input.battleCooldownEnd) !== undefined ||
  filterPendingIncomingTroopArrivals(input.incomingTroopArrivals, input.nowSeconds).length > 0;

export const resolveTimedStructureLabelState = (input: {
  battleCooldownEnd?: number;
  incomingTroopArrivals?: IncomingTroopArrival[];
  nowSeconds: number;
}): { battleTimerLeft?: number; incomingTroopArrivals?: IncomingTroopArrival[]; isActive: boolean } => {
  const filteredIncomingTroopArrivals = filterPendingIncomingTroopArrivals(
    input.incomingTroopArrivals,
    input.nowSeconds,
  );
  const battleTimerLeft = getBattleTimerLeft(input.battleCooldownEnd);
  const normalizedIncomingTroopArrivals =
    filteredIncomingTroopArrivals.length > 0 ? filteredIncomingTroopArrivals : undefined;
  const incomingTroopArrivalsChanged =
    serializeIncomingTroopArrivals(input.incomingTroopArrivals) !==
    serializeIncomingTroopArrivals(filteredIncomingTroopArrivals);

  return {
    battleTimerLeft,
    incomingTroopArrivals: incomingTroopArrivalsChanged ? normalizedIncomingTroopArrivals : input.incomingTroopArrivals,
    isActive: battleTimerLeft !== undefined || filteredIncomingTroopArrivals.length > 0,
  };
};
