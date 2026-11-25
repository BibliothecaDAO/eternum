import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { aspectName, aspects, type AspectId } from "@bibliothecadao/types";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import {
  OPENING,
  OPENING_MOMENTS,
  partShown,
  type OpeningContext,
  type OpeningMoment,
  type OpeningPart,
} from "@/ui/features/frontier/opening/opening";
import { OPENING_RULES } from "@/ui/features/frontier/opening/opening-fixtures";
import {
  activeOpeningMoment,
  EMPTY_OPENING_CONTEXT,
  openedMoments,
  reachedOnContext,
  TUTORIAL_SKIPPED,
} from "@/ui/features/frontier/opening/opening-state";
import { AspectEmissaryDock } from "@/ui/features/frontier/tutorial/aspect-emissary-dock";

const PARTS: readonly OpeningPart[] = OPENING_MOMENTS.flatMap((moment) => OPENING[moment].parts);

function contextForMoment(moment: OpeningMoment): OpeningContext {
  const base: OpeningContext = {
    ...EMPTY_OPENING_CONTEXT,
    hasRealm: true,
    hasBarracks: true,
    troopsAtHome: 2_000,
    deployedArmies: 1,
    hasExplored: true,
  };
  switch (moment) {
    case "season0-welcome":
      return { ...base, isSeasonZeroVeteran: true };
    case "oath":
      return { ...base, hasOpenOathPick: true };
    case "bane":
      return { ...base, hasActiveBane: true };
    case "day-end":
      return { ...base, dayEndingSoon: true };
    case "deep":
      return { ...base, inDeep: true };
    case "quest":
      return { ...base, questRunning: true };
    case "aspects":
      return { ...base, hasAspectRace: true };
    case "spire":
      return { ...base, inEthereal: true };
    case "daily-quest":
      return { ...base, dailyQuestClaimable: true };
    case "essence":
      return { ...base, hasEssence: true, canResearch: true, hasResearched: false };
    case "shop":
      return { ...base, fragmentsSold: true, outOfStamina: true };
    case "relic":
      return { ...base, hasRelic: true };
    case "well-lore":
      return { ...base, hasWellLore: true };
    case "shrine-lore":
      return { ...base, hasShrineLore: true };
    case "city":
      return { ...base, isCity: true };
    case "barracks":
      return { ...EMPTY_OPENING_CONTEXT, hasRealm: true };
    case "deploy":
      return { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, troopsAtHome: 2_000 };
    case "explore":
      return { ...base, hasExplored: false };
  }
}

export function OpeningLab() {
  const [params] = useSearchParams();
  const rawIndex = Number(params.get("case") ?? 0) || 0;
  const initialMoment = OPENING_MOMENTS[Math.min(Math.max(rawIndex, 0), OPENING_MOMENTS.length - 1)]!;
  const [selectedMoment, setSelectedMoment] = useState<OpeningMoment>(initialMoment);
  const [ownAspect, setOwnAspect] = useState<AspectId>(1);
  const [phone, setPhone] = useState(false);
  const [completedPreview, setCompletedPreview] = useState(false);
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());

  const ctx = contextForMoment(selectedMoment);
  const rules = { ...OPENING_RULES, ownAspect };
  const active = activeOpeningMoment(ctx, rules, seen);
  const opened = openedMoments(new Set(), reachedOnContext(ctx));

  const dismissActive = () => {
    if (!active) return;
    setCompletedPreview(false);
    setSeen((prev) => new Set([...prev, active]));
  };

  const skipAll = () => {
    setCompletedPreview(false);
    setSeen((prev) => new Set([...prev, TUTORIAL_SKIPPED]));
  };

  const selectMoment = (moment: OpeningMoment) => {
    setSelectedMoment(moment);
    setCompletedPreview(false);
    setSeen((prev) => {
      const next = new Set(prev);
      next.delete(moment);
      next.delete(TUTORIAL_SKIPPED);
      return next;
    });
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4">
      <nav className="flex flex-wrap gap-2">
        {OPENING_MOMENTS.map((moment) => (
          <button
            key={moment}
            type="button"
            aria-pressed={selectedMoment === moment}
            onClick={() => selectMoment(moment)}
          >
            {moment}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        {aspects.map(({ id }) => (
          <button key={id} type="button" aria-pressed={ownAspect === id} onClick={() => setOwnAspect(id)}>
            {aspectName(id)}
          </button>
        ))}
        <button type="button" aria-pressed={phone} onClick={() => setPhone((was) => !was)}>
          {phone ? "Phone (390)" : "Desktop"}
        </button>
        {selectedMoment in OPENING_WORDS.completed && (
          <button type="button" aria-pressed={completedPreview} onClick={() => setCompletedPreview((was) => !was)}>
            {OPENING_WORDS.completedLabel}
          </button>
        )}
      </div>

      <div data-opening-line className={phone ? "w-[370px] pt-3" : "pt-4"}>
        {active ? (
          <AspectEmissaryDock
            moment={active}
            rules={rules}
            layout={phone ? "phone" : "desktop"}
            status={completedPreview ? "completed" : "showing"}
            onDismiss={dismissActive}
            onSkipAll={skipAll}
          />
        ) : (
          <p className="text-hud-label text-hud-muted">No active tutorial line for this context.</p>
        )}
      </div>

      <ul data-opening-parts className="flex flex-wrap gap-2">
        {PARTS.map((part) => (
          <li key={part} data-part={part} data-shown={partShown(opened, part)}>
            {partShown(opened, part) ? `✔ ${part}` : `· ${part}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
