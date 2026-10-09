import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

const LORDS_MODELS = ["ResourceBalance"] as const;

/** The whole LORDS a realm holds (ruin chests credit it, Refill spends it); undefined until its balance is known. */
export const useRealmLords = (realm: NativeRows["Structure"]): number | undefined => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(LORDS_MODELS);
  const balance = knownBalance(getBalance(realm.entity_id, ResourcesIds.Lords, tick, setup.store).balance);
  return balance === undefined ? undefined : Math.floor(balance);
};
