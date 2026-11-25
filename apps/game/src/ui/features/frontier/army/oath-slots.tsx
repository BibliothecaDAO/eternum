import "./oath-slots.css";

import { heldOaths } from "@bibliothecadao/eternum";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { usePickEffectBase } from "../pick-effect-text";
import { oathEffectDescription, oathName } from "./oath-details";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { configManager, OATH_SLOTS_MAX, troopOathSlots } from "@bibliothecadao/eternum";
import { type TroopType } from "@bibliothecadao/types";
import { useState } from "react";

export const useHomeOathSlots = (category: TroopType | undefined, homeId: number): number | undefined => {
  const { store } = useNativeFacts(["RealmKnowledge"]);
  const learned = store.get("RealmKnowledge", { game_id: configManager.getActiveGameId(), structure_id: homeId });
  return learned && category !== undefined ? troopOathSlots(learned.learned, category) : undefined;
};

export function ArmyOathSockets({ explorerId }: { explorerId: number }) {
  const { store } = useNativeFacts(["ArmyProgress"]);
  const pickBase = usePickEffectBase();
  const progress = store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  if (!progress) return null;
  const oaths = heldOaths(progress.oaths).map((oath) => ({
    icon: orderMeaning(oath),
    name: oathName(oath),
    effect: oathEffectDescription(oath, pickBase),
  }));
  return <OathSockets oaths={oaths} slots={progress.oath_slots} />;
}

export function OathSockets({
  oaths,
  slots,
}: {
  oaths: readonly { icon: IconMeaning; name: string; effect: string }[];
  slots: number;
}) {
  const [hint, setHint] = useState(false);
  return (
    <div role="group" aria-label={RESEARCH_TREE.oathSlots(slots)} data-oath-slots={slots} className="oath-sockets">
      {Array.from({ length: OATH_SLOTS_MAX }, (_, index) => {
        const oath = oaths[index];
        if (oath)
          return (
            <span
              key={index}
              role="img"
              aria-label={oath.name}
              data-tip={`${oath.name} — ${oath.effect}`}
              className="oath-socket"
              data-filled=""
            >
              <Icon name={oath.icon} size={30} />
            </span>
          );
        if (index < slots)
          return (
            <button
              key={index}
              type="button"
              aria-label={RESEARCH_TREE.oathEarn}
              aria-expanded={hint}
              className="oath-socket"
              data-open=""
              onClick={() => setHint((shown) => !shown)}
            >
              +
            </button>
          );
        return (
          <span key={index} role="img" aria-label={RESEARCH_TREE.oathLocked} className="oath-socket" data-locked="">
            <Icon name="lock" size={15} />
          </span>
        );
      })}
      {hint && (
        <p role="status" className="oath-sockets__hint">
          {RESEARCH_TREE.oathEarn}
        </p>
      )}
    </div>
  );
}
