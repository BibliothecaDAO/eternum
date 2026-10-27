import { BLITZ_WORDS, CLOCK_WORDS, LORE_LINE, WORDS } from "@/ui/design-system/kit/words";
import type { CSSProperties, ReactNode } from "react";

import { AppAgeColumn, AppButton, AppGameCard, AppRow } from "@/ui/design-system/kit/app-elements";
import { clockAt, clockLine } from "@/ui/design-system/kit/clock-chip";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

import { PageFrame } from "../frame/page-frame";
import { Loading } from "../loading";
import type { NextBlitzGame } from "../blitz-slot";
import { ageOf } from "./ages";
import { type PlayBoard, PLAY_MODES, type PlayMode } from "./play-board";
import { type PlayFacts, type SourceGap, usePlayFacts } from "./play-facts";
import { ItemRows, LeadCard } from "./play-item";
import { BuildOrdersRow } from "../build-orders/build-orders-row";

/**
 * Play (the owner's pick, B · Ages): the step the player most likely came for, widest, with the page's one gold verb;
 * beside it each age with games of its own, a tall column on its painting, its games under way first, then the next
 * and the finished. Every game appears once. A phone stacks them. A first visit stands on the plains under the lore
 * line.
 */
export const PlayPage = () => {
  const facts = usePlayFacts();
  const firstVisit = !facts.signedIn && facts.board?.lead?.verb === "play";
  const ages = facts.board ? agesShown(facts.board, facts.gaps) : [];
  return (
    <PageFrame painting={firstVisit ? "dark-plains" : "brooding-plains"} stage={firstVisit} offersInstall>
      {firstVisit && <h1 className="mb-6 max-w-[48rem] text-app-display text-app-ink">{LORE_LINE}</h1>}
      <div
        className="grid grid-cols-1 gap-6 lg:min-h-[40rem] lg:[grid-template-columns:var(--play-columns)]"
        style={{ "--play-columns": `minmax(0,1.5fr) repeat(${ages.length}, minmax(0,1fr))` } as CSSProperties}
      >
        <section className="flex min-w-0 flex-col gap-3">
          <LeadOrState facts={facts} />
          {facts.board && <SourceGaps gaps={facts.gaps} />}
        </section>
        {facts.board &&
          ages.map((mode) => (
            <AgeColumn key={mode} mode={mode} facts={facts} items={(facts.board as PlayBoard).ages[mode]} />
          ))}
      </div>
    </PageFrame>
  );
};

/**
 * The ages holding a game besides the lead, in Play's order; and Blitz's always once its slots and the season's calendar
 * answered (an outage of either stands as its gap, never as "none"), so its way to the build orders is always there, a
 * Blitz in the lead or not.
 */
const agesShown = (board: PlayBoard, gaps: readonly SourceGap[]): PlayMode[] =>
  PLAY_MODES.filter(
    (mode) =>
      board.ages[mode].length > 0 ||
      (mode === "blitz" && !gaps.some((gap) => gap.service === "slots" || gap.service === "season")),
  );

/** The lead; the directory's failure, the wait, or the quiet card in its place. */
const LeadOrState = ({ facts }: { facts: PlayFacts }) => {
  if (facts.directory.isError)
    return (
      <QuietLead title={WORDS.play}>
        <ServiceFailure
          service="directory"
          error={facts.directory.error}
          retry={() => void facts.directory.refetch()}
        />
      </QuietLead>
    );
  if (!facts.board)
    return (
      <QuietLead title={WORDS.play}>
        <AppButton kind="primary" size="lg" icon="play" disabled>
          {WORDS.play}
        </AppButton>
      </QuietLead>
    );
  // With no lead, the quiet card speaks only once every source answered: a read still out or failed is not "nothing".
  if (!facts.board.lead && facts.gaps.length > 0) return null;
  if (!facts.board.lead) return <QuietLead title={WORDS.noSeason} />;
  return <LeadCard item={facts.board.lead} now={facts.now} signedIn={facts.signedIn} className="h-full" />;
};

/** The lead's place while there is no lead: Frontier's painting, a line, and what stands in for the verb. */
const QuietLead = ({ title, children }: { title: string; children?: ReactNode }) => (
  <AppGameCard age="frontier" painting="frontier-mist" size="lead" className="h-full" title={title} verb={children} />
);

/**
 * The reads Play has not had in full, each in its own words with Try again: Blitz's slots, the player's results. The
 * games that did answer stay usable beside them.
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

/**
 * One age's column: its painting and its name, then its games in its well (Blitz's, with none and no Blitz in the lead:
 * the calendar's next game, or none left in the season); Blitz's ends on the way to the player's build orders.
 */
const AgeColumn = ({
  mode,
  facts,
  items,
}: {
  mode: PlayMode;
  facts: PlayFacts;
  items: PlayBoard["ages"][PlayMode];
}) => {
  const age = ageOf(mode);
  return (
    <AppAgeColumn age={mode} painting={age.painting} name={age.name}>
      {items.length > 0 ? (
        <ItemRows items={items} now={facts.now} signedIn={facts.signedIn} />
      ) : (
        facts.board?.lead?.mode !== "blitz" && <NextBlitz next={facts.nextBlitz} now={facts.now} />
      )}
      {mode === "blitz" && <BuildOrdersRow />}
    </AppAgeColumn>
  );
};

/**
 * Blitz's column with no game open (owner, 2026-10-21: the card shows the next start until the game is published): the
 * season calendar's next game, its start and when its entry opens, in the player's local time; "No Blitz" only when the
 * season has none left.
 */
const NextBlitz = ({ next, now }: { next: NextBlitzGame | null | undefined; now: number }) => {
  if (next === undefined) return null;
  if (next === null) return <p className="text-app-body text-app-muted">{BLITZ_WORDS.noneScheduled}</p>;
  const startsAt = Date.parse(next.startsAt) / 1000;
  const opensAt = Date.parse(next.opensAt) / 1000;
  const entry = opensAt > now ? clockLine("entryOpens", opensAt, now) : BLITZ_WORDS.entryOpening;
  return (
    <ul className="app-well">
      <li data-play-item={`next:${next.name}`}>
        <AppRow title={BLITZ_WORDS.nextRanked} detail={`${CLOCK_WORDS.starts} ${clockAt(startsAt, now)} · ${entry}`} />
      </li>
    </ul>
  );
};
