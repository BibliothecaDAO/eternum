import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { bankedCounterTarget } from "@/ui/motion/moments/banked-flight";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import type { ComponentProps } from "react";

import { useRealmStores } from "../realm-stores";
import { dayClock } from "./day-clock";
import { StatusStrip, type StoreReading } from "./status-strip";

/**
 * The strip over the game's facts: today on the season's calendar, and what the realm holds against each store's limit,
 * its tone amber within the hour of full and ember at the limit (a visited realm's when visiting). Troops count what
 * the next deploy finds, Homecoming's return included.
 */
export const FrontierStrip = ({
  rules,
  realm,
  onOpenDay,
  storeCards,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  /** Today, the day's report, from a tap on the day's dial. */
  onOpenDay: () => void;
  /** The stores whose plate opens their card; absent while visiting. */
  storeCards?: ComponentProps<typeof StatusStrip>["storeCards"];
}) => {
  const clock = dayClock(rules, useNowSeconds());
  return (
    <StatusStrip clock={clock} stores={useStoreReadings(realm, rules)} onOpenDay={onOpenDay} storeCards={storeCards} />
  );
};

/** Each store of the realm (the strip's plates, the realm panel's rings): its reading and where a payout of it lands. */
export const useStoreReadings = (realm: NativeRows["Structure"] | null, rules: ExpeditionRules): StoreReading[] => {
  const stores = useRealmStores(realm, rules);
  return PLATES.map(({ kind, flyTarget }) => {
    const store = stores?.[kind];
    return {
      kind,
      amount: store?.amount,
      limit: store?.limit,
      perHour: store?.perHour,
      fullIn: store?.fullIn,
      tone: store?.tone ?? "calm",
      flyTarget,
    };
  });
};

const PLATES: { kind: StoreReading["kind"]; flyTarget: string }[] = [
  { kind: "essence", flyTarget: bankedCounterTarget(ResourcesIds.Essence) },
  { kind: "labor", flyTarget: bankedCounterTarget(ResourcesIds.Labor) },
  { kind: "wheat", flyTarget: bankedCounterTarget(ResourcesIds.Wheat) },
  // Troops at home take no flight of their own; their plate still names a landing target so the strip stays uniform.
  { kind: "troops", flyTarget: "troops-at-home" },
];
