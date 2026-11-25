import "./oath-slots.css";

import { heldOaths } from "@bibliothecadao/eternum";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import { usePickEffectBase } from "../pick-effect-text";
import { oathEffectDescription, oathName, oathStatBadge } from "./oath-details";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import { configManager, OATH_SLOTS_MAX } from "@bibliothecadao/eternum";
import { useState } from "react";

const useHeldOaths = (explorerId: number) => {
  const { store } = useNativeFacts(["ArmyProgress"]);
  const baseFor = usePickEffectBase(explorerId);
  const progress = store.get("ArmyProgress", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  if (!progress) return undefined;
  const oaths = heldOaths(progress.oaths).map((oath) => ({
    icon: orderMeaning(oath),
    name: oathName(oath),
    effect: oathEffectDescription(oath, baseFor(oath)),
    badge: oathStatBadge(oath, baseFor(oath)),
  }));
  return { oaths, slots: progress.oath_slots };
};

export function ArmyOathSockets({ explorerId }: { explorerId: number }) {
  const held = useHeldOaths(explorerId);
  return held ? <OathSockets oaths={held.oaths} slots={held.slots} /> : null;
}

export function ArmyOathEffects({ explorerId }: { explorerId: number }) {
  const held = useHeldOaths(explorerId);
  if (!held || held.oaths.length === 0) return null;
  return (
    <ul data-oath-effects className="oath-effects">
      {held.oaths.map(({ name, badge }) => (
        <li key={name} className="oath-effects__row">
          <b className="oath-effects__name">{name}</b>
          <span className="oath-effects__hero">{badge.hero}</span>
          <span className="oath-effects__unit">{badge.unit}</span>
        </li>
      ))}
    </ul>
  );
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
