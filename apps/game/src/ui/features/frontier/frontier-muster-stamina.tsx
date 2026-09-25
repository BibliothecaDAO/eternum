import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { musterStamina, type OpenArmySlot, openArmySlots } from "@bibliothecadao/eternum/troop-stamina";
import type { TroopTier, TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { useExpeditionRules } from "./frontier-home";

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

/**
 * The muster's stamina line in games whose armies keep their bar in a daily slot: the bar the new army starts on,
 * fresh, or what the slot's last army left today, so replacing a tired army never looks like a free refill.
 */
export const MusterStamina = ({
  structureId,
  troop,
}: {
  structureId: number;
  troop: { type: TroopType; tier: TroopTier };
}) => {
  const { setup } = useGame();
  const rules = useExpeditionRules();
  const tick = useCurrentArmiesTick();
  const realm = setup.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureId });
  const next = useOpenArmySlots(realm)?.[0];
  if (!rules) return null;
  const bar = next
    ? musterStamina(
        next,
        { category: troop.type, tier: troop.tier },
        tick,
        configManager.getTroopConfig().troop_stamina_config,
      )
    : undefined;

  return (
    <>
      <div className="border-t border-gold/15" />
      <p className="px-1 py-1 text-[11px] text-gold/80" aria-label="Starting stamina">
        {bar ? `Starts with ${bar.amount}/${bar.max} stamina` : "Starting stamina —"}
        {next?.inherited && " · this slot's last army left it tired"}
      </p>
    </>
  );
};
