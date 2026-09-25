import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { type OpenArmySlot, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import { useMemo } from "react";

const SLOT_MODELS = ["ArmySlot", "Structure"] as const;

/** The home's vacant army slots today, lowest first; undefined until every slot is known. */
export const useOpenArmySlots = (realm: NativeRows["Structure"] | null | undefined): OpenArmySlot[] | undefined => {
  const { setup } = useGame();
  const revision = useNativeRevision(SLOT_MODELS);
  return useMemo(
    () =>
      realm
        ? openArmySlots(setup.store, {
            game_id: realm.game_id,
            entity_id: realm.entity_id,
            allowedSlots: realm.base.troop_max_explorer_count,
          })
        : undefined,
    [realm, revision, setup.store],
  );
};

/** What a slot hands its next army, as the dock's Muster card reads it. */
export const describeSlotBar = (slot: OpenArmySlot | undefined): string =>
  slot === undefined ? "—" : slot.inherited ? "Tired bar" : "Fresh bar";
