import "./oath-slots.css";

import { heldOaths } from "@bibliothecadao/eternum";
import { Icon } from "@/ui/design-system/icon";
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

export function TroopOathSlots({
  category,
  homeId,
  explorerId,
}: {
  category: TroopType;
  homeId?: number;
  explorerId?: number;
}) {
  const { store } = useNativeFacts(["ArmyProgress", "RealmKnowledge", "ResearchPrice"]);
  const pickBase = usePickEffectBase();
  const game_id = configManager.getActiveGameId();
  const learned = homeId === undefined ? undefined : store.get("RealmKnowledge", { game_id, structure_id: homeId });
  const count =
    explorerId === undefined
      ? learned && troopOathSlots(learned.learned, category)
      : store.get("ArmyProgress", { game_id, explorer_id: explorerId })?.oath_slots;
  if (count === undefined) return null;
  const progress =
    explorerId === undefined ? undefined : store.get("ArmyProgress", { game_id, explorer_id: explorerId });
  const held = heldOaths(progress?.oaths ?? 0);
  return (
    <div data-oath-slots={count} className="flex flex-col gap-1">
      <span className="text-hud-label text-hud-ink">{RESEARCH_TREE.oathSlots(count)}</span>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${OATH_SLOTS_MAX}, minmax(0, 1fr))` }}>
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
              aria-label={`${RESEARCH_TREE.oathSlots(index + 1)} · ${open ? RESEARCH_TREE.oathOpen : RESEARCH_TREE.oathLocked}`}
              className="oath-slot flex min-w-0 flex-col gap-1 overflow-hidden break-words rounded border border-hud-line p-1 text-hud-label text-hud-muted"
            >
              {oath ? (
                <>
                  <Icon name={orderMeaning(oath)} />
                  <span>{oathName(oath)}</span>
                  <span>{oathEffectDescription(oath, pickBase)}</span>
                </>
              ) : open ? (
                RESEARCH_TREE.oathOpen
              ) : (
                RESEARCH_TREE.oathLocked
              )}
              {price && (
                <HudCost
                  line={costLine([
                    { of: "essence", amount: Number(price.essence) / RESOURCE_PRECISION },
                    { of: "labor", amount: Number(price.labor) / RESOURCE_PRECISION },
                  ])}
                />
              )}
            </div>
          );
        })}
      </div>
      {count < OATH_SLOTS_MAX && (
        <span className="min-w-0 break-words text-hud-label text-hud-muted">{RESEARCH_TREE.oathResearch}</span>
      )}
    </div>
  );
}
