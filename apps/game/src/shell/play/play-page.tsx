import { useState } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Button } from "@/ui/design-system/kit/button";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { LORE_LINE, PLAY_WORDS, WORDS } from "../words";
import { ageOf } from "./ages";
import { type PlayBoard, PLAY_MODES, type PlayMode } from "./play-board";
import { type PlayFacts, usePlayFacts } from "./play-facts";
import { ItemRows, LeadCard, SectionLabel } from "./play-item";
import { Loading } from "../loading";
import { ServiceFailure } from "../service-failure";
import type { SourceGap } from "./play-facts";
import { FailureCard, StateCard } from "./state-card";

/**
 * Play: what the player can do now, then each mode's next and finished games. "Now" leads and stays in view: the lead
 * with the one gold verb, and everything else under way with its own. Below it, a switch shows one mode's next and
 * finished games at a time, opening on the first with something to do; a dot marks a mode holding something of the
 * player's. Every game appears once. A first visit stands on the plains painting under the lore line.
 */
export const PlayPage = () => {
  const facts = usePlayFacts();
  const desktop = useLayout() === "desktop";
  const firstVisit = !facts.signedIn && facts.board?.lead?.verb === "play";
  const lead = facts.board?.lead;
  return (
    <PageFrame
      painting={firstVisit ? "dark-plains" : ageOf(lead?.mode ?? "frontier").painting}
      stage={firstVisit}
      offersInstall
    >
      {firstVisit && <LoreLine />}
      <div
        className={
          desktop ? "grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-6" : "flex flex-col gap-4 pb-2"
        }
      >
        <NowSection facts={facts} />
        {facts.board && <LaterSection facts={facts} board={facts.board} />}
      </div>
    </PageFrame>
  );
};

/** The first visit's line, as the page's title. */
const LoreLine = () => (
  <h1 className="mb-5 max-w-[16ch] font-display text-[32px] leading-[1.08] text-kit-cream [text-shadow:0_2px_0_theme(colors.kit.ink/70%),0_0_24px_theme(colors.kit.ink/60%)] lg:text-[52px]">
    {LORE_LINE}
  </h1>
);

/** The lead and everything else under way; the directory's failure, the wait, or the quiet card in the lead's place. */
const NowSection = ({ facts }: { facts: PlayFacts }) => (
  <section className="flex flex-col gap-3">
    <SectionLabel>{PLAY_WORDS.now}</SectionLabel>
    <LeadOrState facts={facts} />
    {facts.board && <SourceGaps gaps={facts.gaps} />}
    {facts.board && facts.board.now.length > 0 && (
      <ItemRows items={facts.board.now} now={facts.now} signedIn={facts.signedIn} />
    )}
  </section>
);

const LeadOrState = ({ facts }: { facts: PlayFacts }) => {
  if (facts.directory.isError)
    return (
      <FailureCard service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />
    );
  if (!facts.board)
    return (
      <StateCard painting="frontier-mist">
        <Button role="primary" word={WORDS.play} icon="Pl" disabled />
      </StateCard>
    );
  // With no lead, the quiet card speaks only once every source answered: a read still out or failed is not "nothing".
  if (!facts.board.lead && facts.gaps.length > 0) return null;
  if (!facts.board.lead)
    return (
      <StateCard painting="brooding-plains">
        <p className="font-body text-lg font-bold text-kit-cream">{WORDS.noSeason}</p>
      </StateCard>
    );
  return <LeadCard item={facts.board.lead} now={facts.now} signedIn={facts.signedIn} />;
};

/**
 * The reads Play has not had in full, each in its own words with Try again: Blitz's slots, the player's results. The
 * games that did answer stay usable above and below.
 */
const SourceGaps = ({ gaps }: { gaps: readonly SourceGap[] }) =>
  gaps.length === 0 ? null : (
    <div className="flex flex-col gap-2">
      {gaps.map((gap) =>
        gap.kind === "failed" ? (
          <ServiceFailure key={gap.service} service={gap.service} error={gap.error} retry={gap.retry} />
        ) : (
          <Loading key={gap.service} />
        ),
      )}
    </div>
  );

/** Each mode's next and finished games, one mode at a time; absent when no mode has any. */
const LaterSection = ({ facts, board }: { facts: PlayFacts; board: PlayBoard }) => {
  const [picked, setPicked] = useState<PlayMode | null>(null);
  const modes = PLAY_MODES.filter((mode) => board.later[mode].length > 0);
  if (modes.length === 0) return null;
  const shown =
    picked !== null && modes.includes(picked) ? picked : modes.includes(board.openMode) ? board.openMode : modes[0];
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>{PLAY_WORDS.later}</SectionLabel>
      {modes.length > 1 && <ModeSwitch modes={modes} shown={shown} marked={board.marked} onPick={setPicked} />}
      <ItemRows items={board.later[shown]} now={facts.now} signedIn={facts.signedIn} />
    </section>
  );
};

const ModeSwitch = ({
  modes,
  shown,
  marked,
  onPick,
}: {
  modes: readonly PlayMode[];
  shown: PlayMode;
  marked: readonly PlayMode[];
  onPick: (mode: PlayMode) => void;
}) => (
  <div role="tablist" aria-label={PLAY_WORDS.modes} className="flex gap-2">
    {modes.map((mode) => {
      const on = mode === shown;
      return (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={on}
          onClick={() => onPick(mode)}
          className={cn(
            "relative min-h-12 flex-1 rounded-xl border px-3 font-body text-base font-bold text-kit-cream",
            on ? "border-kit-gold bg-kit-plate2" : "border-kit-line2 bg-kit-plate hover:border-kit-gold",
          )}
        >
          {ageOf(mode).name}
          {!on && marked.includes(mode) && (
            <span
              aria-label={PLAY_WORDS.yours}
              className="absolute right-2.5 top-2 size-2.5 rounded-full bg-kit-peach"
            />
          )}
        </button>
      );
    })}
  </div>
);
