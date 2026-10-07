import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { bankedCounterTarget } from "@/ui/motion/moments/banked-flight";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance, type readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

import { troopsOnHand } from "../frontier-home";
import { dayClock } from "./day-clock";
import { StatusStrip, type StoreReading } from "./status-strip";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

const BALANCE_MODELS = ["ResourceBalance", "ResourceProduction"] as const;
/** Troops at home take no flight of their own; their plate still names a landing target so the strip stays uniform. */
const TROOPS_TARGET = "troops-at-home";

/**
 * The strip over the game's facts: today on the game's clock, and what the realm holds (a visited realm's when
 * visiting). The stores' limits arrive with the contracts' store limits; until then no limit bar is drawn.
 */
export const FrontierStrip = ({
  rules,
  realm,
  onOpenStores,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  /** Production, from a tap on the stores; absent while visiting. */
  onOpenStores?: () => void;
}) => {
  const clock = dayClock(rules, useNowSeconds());
  const stores = useRealmStores(realm);
  return <StatusStrip clock={clock} stores={stores} onOpenStores={onOpenStores} />;
};

const useRealmStores = (realm: NativeRows["Structure"] | null): StoreReading[] => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(BALANCE_MODELS);
  const balance = (resourceId: ResourcesIds) =>
    realm ? knownBalance(getBalance(realm.entity_id, resourceId, tick, setup.store).balance) : undefined;
  const banked = (kind: StoreReading["kind"], resourceId: ResourcesIds): StoreReading => ({
    kind,
    amount: balance(resourceId),
    limit: undefined,
    tone: "calm",
    flyTarget: bankedCounterTarget(resourceId),
  });
  return [
    banked("essence", ResourcesIds.Essence),
    banked("labor", ResourcesIds.Labor),
    banked("wheat", ResourcesIds.Wheat),
    {
      kind: "troops",
      amount: realm ? troopsOnHand(setup.store, realm.entity_id, tick) : undefined,
      limit: undefined,
      tone: "calm",
      flyTarget: TROOPS_TARGET,
    },
  ];
};
