import { bankedCounterTarget } from "@/ui/motion/moments/banked-flight";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import { nativeResearchConstants, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { usePartShown } from "../opening/opening-context";
import { useRealmStores } from "../realm-stores";
import { FRONTIER_STORES, STORE_KINDS, type StoreKind } from "../stores";
import type { StoreReading } from "./status-strip";

export const useStoreReadings = (
  realm: NativeRows["Structure"] | null,
  rules: ExpeditionRules,
  kinds?: readonly StoreKind[],
): StoreReading[] => {
  const stores = useRealmStores(realm, rules);
  const shown: Partial<Record<StoreKind, boolean>> = {
    essence: usePartShown("essence-store"),
    crossbows: realm !== null && realm.base.level >= nativeResearchConstants.RANGE_LEVEL,
    scouts: realm !== null && realm.base.level >= nativeResearchConstants.SCOUTS_LODGE_LEVEL,
  };
  return (kinds ?? STORE_KINDS.filter((kind) => shown[kind] ?? true)).map((kind) => {
    const store = stores?.[kind];
    return {
      kind,
      amount: store?.amount,
      limit: store?.limit,
      perHour: store?.perHour,
      fullIn: store?.fullIn,
      tone: store?.tone ?? "calm",
      flyTarget: flyTarget(kind),
    };
  });
};

/** Where a payout of a store lands: its banked counter. Troops at home take no flight of their own; their plate still
 * names a landing target so the strip stays uniform. */
const flyTarget = (kind: StoreKind): string =>
  kind === "troops" ? "troops-at-home" : bankedCounterTarget(FRONTIER_STORES[kind].resource);
