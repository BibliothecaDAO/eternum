import { BLITZ_WORDS, LORE_LINE, WORDS } from "@/ui/design-system/kit/words";
import type { CSSProperties, ReactNode } from "react";

import { AppAgeColumn, AppButton, AppGameCard } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

import { PageFrame } from "../frame/page-frame";
import { Loading } from "../loading";
import { ageOf } from "./ages";
import { holdsNothing, idleCard, type PlayBoard, PLAY_MODES, type PlayMode } from "./play-board";
import { type PlayFacts, type SourceGap, usePlayFacts } from "./play-facts";
import { ItemRows, LeadCard } from "./play-item";
import { PreseasonPlay } from "./preseason-pick";
import { SeasonCountdown } from "./season-countdown";
import { BuildOrdersRow } from "../build-orders/build-orders-row";

/**
 * Play (the owner's pick, B · Ages): the step the player most likely came for, widest, with the page's one gold verb;
 * beside it each age with games of its own, a tall column on its painting, its games under way first, then the next
 * and the finished. Every game appears once. A phone stacks them. A first visit stands on the plains under the lore
 * line.
 */
export const PlayPage = () => {
  const facts = usePlayFacts();
  if (facts.opening && isPlayEmpty(facts))
    return facts.signedIn ? (
      <PreseasonPlay opening={facts.opening} now={facts.now} />
    ) : (
      <SeasonCountdown opening={facts.opening} now={facts.now} />
    );
  const firstVisit = !facts.signedIn && facts.board?.lead?.verb === "play";
  const ages = facts.board ? agesShown(facts.board) : [];
  return (
    <PageFrame painting={firstVisit ? "dark-plains" : "brooding-plains"} stage={firstVisit} offersInstall>
      {/* On a short phone (a browser's toolbars showing) the line draws at title size, so Play free stays on the first
          screen. */}
      {firstVisit && (
        <h1 className="mb-6 max-w-[48rem] text-app-display text-app-ink [@media(max-height:720px)]:mb-3 [@media(max-height:720px)]:text-app-title">
          {LORE_LINE}
        </h1>
      )}
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

const isPlayEmpty = (facts: PlayFacts) =>
  facts.board !== undefined && holdsNothing(facts.board) && facts.gaps.length === 0;

const agesShown = (board: PlayBoard): PlayMode[] =>
  PLAY_MODES.filter((mode) => board.ages[mode].length > 0 || mode === "blitz");

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
  const blitzLeads = facts.board?.lead?.mode === "blitz";
  const buildOrders = mode === "blitz" && (items.length > 0 || blitzLeads);
  const idle = idleCard(items, buildOrders);
  return (
    <AppAgeColumn age={mode} painting={age.painting} name={age.name} idle={idle}>
      {items.length > 0 ? (
        <ItemRows items={items} now={facts.now} signedIn={facts.signedIn} />
      ) : (
        !blitzLeads && <p className="text-app-body text-app-muted">{BLITZ_WORDS.noneScheduled}</p>
      )}
      {buildOrders && <BuildOrdersRow />}
    </AppAgeColumn>
  );
};
