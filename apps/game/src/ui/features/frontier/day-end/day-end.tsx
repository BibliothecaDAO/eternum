import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { openOnMap } from "@/play/navigation/open-place";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { DAY_END } from "@/ui/design-system/kit/words";
import { Position } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { frontierSiteName, StructureType } from "@bibliothecadao/types";

import type { useExpeditionRules } from "../frontier-home";
import { dayClock, dayEndUrgency, type DayClock } from "../hud/day-clock";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { type DayEndFacts, useDayEndFacts } from "./day-end-facts";

type ExpeditionRules = NonNullable<ReturnType<typeof useExpeditionRules>>;

/** One thing the day's end would take that the player can still do, with the button that does it. */
export interface DayEndItem {
  key: "claim" | "camp" | "explore";
  icon: IconMeaning;
  line: string;
  verb: string;
}

/** What the player can still do before the day ends, each only while it is still to do. */
export const dayEndItems = ({
  claimWaiting,
  camp,
  armyCanExplore,
}: DayEndFacts & { claimWaiting: boolean }): DayEndItem[] => {
  const items: DayEndItem[] = [];
  if (claimWaiting) items.push({ key: "claim", icon: "labor", line: DAY_END.claim, verb: DAY_END.claimVerb });
  if (camp)
    items.push({
      key: "camp",
      icon: "camp",
      line: DAY_END.site(frontierSiteName(StructureType.Camp)),
      verb: DAY_END.siteVerb,
    });
  if (armyCanExplore) items.push({ key: "explore", icon: "explore", line: DAY_END.explore, verb: DAY_END.exploreVerb });
  return items;
};

/** The day's end as the player's HUD reads it: today's clock, what is left to do, and each row's button. */
export interface DayEnd {
  clock: DayClock;
  items: DayEndItem[];
  run: (key: DayEndItem["key"]) => void;
}

/**
 * The player's day end: today's clock and the list, a claim opening Realms (`onClaim`), today's camp shown on the map,
 * and the readiest army selected there.
 */
export const useDayEnd = (
  rules: ExpeditionRules,
  realm: NativeRows["Structure"] | null,
  { claimWaiting, onClaim }: { claimWaiting: boolean; onClaim: () => void },
): DayEnd => {
  const clock = dayClock(rules, useNowSeconds());
  const facts = useDayEndFacts(rules, realm);
  const armies = useDockArmies(realm);
  const selectArmy = useSelectArmyOnMap();
  const run = (key: DayEndItem["key"]) => {
    if (key === "claim") return onClaim();
    if (key === "camp") return facts.camp && openOnMap(Position.fromContract(facts.camp), "tile");
    const readiest = readiestArmy(armies);
    return readiest && selectArmy(readiest.explorerId);
  };
  return { clock, items: dayEndItems({ ...facts, claimWaiting }), run };
};

/** The army with the most stamina left: the one that can act. */
const readiestArmy = (armies: readonly DockArmy[]): DockArmy | undefined =>
  armies.toSorted((left, right) => (right.stamina?.current ?? 0) - (left.stamina?.current ?? 0))[0];

/**
 * The last hour's line in the notices band (owner's pick, 4 November 2026: day end B): when the day ends and how much
 * is left to do, red in its last ten minutes; Open goes to Today, which says what goes. None before the last hour.
 */
export const DayEndNotice = ({ dayEnd: { clock, items }, onOpen }: { dayEnd: DayEnd; onOpen: () => void }) => {
  if (clock.tone !== "ember" || clock.secondsLeft === undefined) return null;
  const left = items.length > 0 ? ` · ${DAY_END.toDo(items.length)}` : "";
  return (
    <HudNotice
      tone={dayEndUrgency(clock.secondsLeft)}
      icon="hourglass"
      line={`${DAY_END.endsIn(clock.day, clock.secondsLeft)}${left}`}
      fix={{ label: DAY_END.open, onClick: onOpen }}
    />
  );
};

/**
 * Today's day-end block, compact (owner, 4 November 2026: "the full card can be more compact just the important info"):
 * what the end takes in one line, then only what can still be done, each with its button.
 */
export const DayEndBlock = ({ dayEnd: { items, run } }: { dayEnd: DayEnd }) => (
  <section aria-label={DAY_END.goes} className="flex flex-col gap-1">
    <HudNotice tone="warn" icon="hourglass" line={DAY_END.goes} />
    {items.map((item) => (
      <div key={item.key} className="flex items-center gap-2">
        <Icon name={item.icon} size={24} />
        <span className="min-w-0 flex-1 text-hud-body text-hud-ink">{item.line}</span>
        <HudButton kind="secondary" size="sm" onClick={() => run(item.key)}>
          {item.verb}
        </HudButton>
      </div>
    ))}
  </section>
);
