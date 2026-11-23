import "./play-page.css";

import { aspects, type AspectId } from "@bibliothecadao/types";
import { ASPECT_PAGE_WORDS, BLITZ_WORDS, WORDS } from "@/ui/design-system/kit/words";
import type { CSSProperties, ReactNode } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppAgeColumn, AppButton, AppGameCard, AppLink, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

import { BuildOrdersRow } from "../build-orders/build-orders-row";
import { PageFrame } from "../frame/page-frame";
import { Loading } from "../loading";
import { ageOf } from "./ages";
import { holdsNothing, idleCard, type PlayBoard, PLAY_MODES, type PlayMode } from "./play-board";
import { type PlayFacts, type SourceGap, usePlayFacts } from "./play-facts";
import { ItemRows, LeadCard } from "./play-item";
import { PreseasonPlay } from "./preseason-pick";
import { SeasonCountdown } from "./season-countdown";

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
  const leadMembers = facts.board?.lead?.mode === "frontier" ? (facts.board.lead.game.aspect_members ?? null) : null;
  return (
    <PageFrame painting={firstVisit ? "dark-plains" : "brooding-plains"} stage={firstVisit} offersInstall>
      <div data-play-page className="play-grid">
        <section className="flex min-w-0 flex-col gap-3">
          <LeadOrState facts={facts} />
          {facts.board && <SourceGaps gaps={facts.gaps} />}
        </section>
        {facts.board && (
          <div className="play-side">
            {facts.board.lead?.mode === "frontier" && <AspectRacePreview members={leadMembers} />}
            {ages.map((mode) => (
              <AgeColumn key={mode} mode={mode} facts={facts} items={(facts.board as PlayBoard).ages[mode]} />
            ))}
          </div>
        )}
      </div>
    </PageFrame>
  );
};

const isPlayEmpty = (facts: PlayFacts) =>
  facts.board !== undefined && holdsNothing(facts.board) && facts.gaps.length === 0;

const agesShown = (board: PlayBoard): PlayMode[] =>
  PLAY_MODES.filter((mode) => board.ages[mode].length > 0 || mode === "blitz");

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
  if (!facts.board.lead && facts.gaps.length > 0) return null;
  if (!facts.board.lead) return <QuietLead title={WORDS.noSeason} />;
  return <LeadCard item={facts.board.lead} now={facts.now} signedIn={facts.signedIn} className="h-full" />;
};

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

const AspectRacePreview = ({ members }: { members: Readonly<Record<AspectId, number>> | null }) => {
  const maxMembers = members ? Math.max(1, ...aspects.map(({ id }) => members[id] ?? 0)) : 1;
  return (
    <AppPanel
      title={ASPECT_PAGE_WORDS.race}
      icon="crown"
      cue={
        <AppLink to="/season" className="text-app-label text-app-gold">
          {WORDS.season}
        </AppLink>
      }
    >
      <ul className="play-aspects">
        {aspects.map(({ id, name }) => {
          const count = members?.[id] ?? null;
          const share = count === null ? 65 : Math.max(18, Math.round((count / maxMembers) * 100));
          return (
            <li key={id} data-aspect-id={id} style={aspectVariables(id) as CSSProperties} className="play-aspect">
              <AspectMark aspect={id} size={42} decorative />
              <div className="play-aspect__bar" aria-hidden="true">
                <div className="play-aspect__fill" style={{ width: `${share}%` }} />
              </div>
              <span className="play-aspect__name">{name}</span>
              {count !== null && <span className="play-aspect__count">{count}</span>}
            </li>
          );
        })}
      </ul>
    </AppPanel>
  );
};

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
