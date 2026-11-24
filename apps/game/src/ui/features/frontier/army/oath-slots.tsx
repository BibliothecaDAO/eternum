import "./oath-slots.css";

import { heldOaths } from "@bibliothecadao/eternum";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { orderMeaning } from "@/ui/design-system/icon-meaning";
import type { PickEffectBase } from "../pick-effect-format";
import { usePickEffectBase } from "../pick-effect-text";
import { oathEffectDescription, oathName } from "./oath-details";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { HudCost } from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";
import {
  configManager,
  OATH_SLOTS_MAX,
  oathResearchRow,
  oathSlotResearchTier,
  troopOathSlots,
} from "@bibliothecadao/eternum";
import { formatExact, RESOURCE_PRECISION, type TroopType } from "@bibliothecadao/types";
import { useState } from "react";

export function OathSlotPips({
  held,
  slots,
  pickBase,
}: {
  held: readonly number[];
  slots: number;
  pickBase: PickEffectBase;
}) {
  return (
    <div className="oath-pips" aria-label={`Slots ${held.length} of ${slots}`}>
      <div className="oath-pips__row">
        {Array.from({ length: slots }, (_, index) => {
          const oath = held[index];
          const active = oath === undefined && index === held.length;
          return (
            <span
              key={index}
              className="oath-pip"
              data-filled={oath ? "" : undefined}
              data-active={active ? "" : undefined}
              title={oath ? `${oathName(oath)} — ${oathEffectDescription(oath, pickBase)}` : RESEARCH_TREE.oathOpen}
            >
              {oath ? (
                <Icon name={orderMeaning(oath)} size={18} />
              ) : (
                <span className="oath-pip__num" aria-hidden="true">
                  {formatExact(index + 1)}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** How many Oaths a new army of this troop raised at this home can hold, from what the home has researched. */
export const useHomeOathSlots = (category: TroopType | undefined, homeId: number): number | undefined => {
  const { store } = useNativeFacts(["RealmKnowledge"]);
  const learned = store.get("RealmKnowledge", { game_id: configManager.getActiveGameId(), structure_id: homeId });
  return learned && category !== undefined ? troopOathSlots(learned.learned, category) : undefined;
};

export function TroopOathSlots({ category, explorerId }: { category: TroopType; explorerId: number }) {
  const { store } = useNativeFacts(["ArmyProgress", "ResearchPrice"]);
  const pickBase = usePickEffectBase();
  const game_id = configManager.getActiveGameId();
  const progress = store.get("ArmyProgress", { game_id, explorer_id: explorerId });
  const count = progress?.oath_slots;
  if (count === undefined) return null;
  const held = heldOaths(progress?.oaths ?? 0);
  return (
    <div data-oath-slots={count} className="oath-board">
      <div className="oath-board__head">
        <span className="oath-board__title">{RESEARCH_TREE.oathSlots(count)}</span>
        {held.length < count && <span className="oath-board__hint">{RESEARCH_TREE.oathEarn}</span>}
      </div>
      <div className="oath-board__row">
        {Array.from({ length: OATH_SLOTS_MAX }, (_, index) => {
          const open = index < count;
          const oath = held[index];
          const price = open
            ? undefined
            : store.get("ResearchPrice", {
                game_id,
                row: oathResearchRow[category],
                tier: oathSlotResearchTier(index),
              });
          return (
            <div
              key={index}
              data-filled={oath ? "" : undefined}
              data-open={open && !oath ? "" : undefined}
              data-locked={open ? undefined : ""}
              data-tip={oath ? `${oathName(oath)} — ${oathEffectDescription(oath, pickBase)}` : undefined}
              aria-label={`${RESEARCH_TREE.oathSlots(index + 1)} · ${open ? RESEARCH_TREE.oathOpen : RESEARCH_TREE.oathLocked}`}
              className="oath-card"
            >
              {oath ? (
                <>
                  <Icon name={orderMeaning(oath)} size={24} />
                  <span className="oath-card__word">{oathName(oath)}</span>
                </>
              ) : open ? (
                <>
                  <span className="oath-card__plus" aria-hidden="true">
                    +
                  </span>
                  <span className="oath-card__word">{RESEARCH_TREE.oathOpen}</span>
                </>
              ) : (
                <>
                  <Icon name="lock" size={16} />
                  {price && (
                    <HudCost
                      line={costLine([
                        { of: "essence", amount: Number(price.essence) / RESOURCE_PRECISION },
                        { of: "labor", amount: Number(price.labor) / RESOURCE_PRECISION },
                      ])}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {count < OATH_SLOTS_MAX && <span className="oath-board__more">{RESEARCH_TREE.oathResearch}</span>}
    </div>
  );
}

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
    <div role="group" aria-label={RESEARCH_TREE.oathSlots(slots)} className="oath-sockets">
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
