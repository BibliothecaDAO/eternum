import "./play-page.css";

import type { HeraldAspectRace } from "@bibliothecadao/eternum/game-sync";
import { aspects, formatExact, questCatalog, type QuestId } from "@bibliothecadao/types";
import {
  ASPECT_PAGE_WORDS,
  BLITZ_WORDS,
  DAY,
  DAY_BANNER_WORDS,
  OF,
  WORDS,
  dayLeftCompact,
} from "@/ui/design-system/kit/words";
import type { CSSProperties, ReactNode } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AppAgeColumn, AppButton, AppChip, AppGameCard, AppLink, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { dayQuestFace } from "@/ui/features/frontier/day/day-quest-face";

import { BuildOrdersRow } from "../build-orders/build-orders-row";
import { PageFrame } from "../frame/page-frame";
import type { DirectoryGame } from "../herald";
import { Loading } from "../loading";
import { directoryDay, seasonRealm } from "../season";
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
  const leadFrontier = facts.board?.lead?.mode === "frontier" ? facts.board.lead.game : null;
  const leadRace = leadFrontier?.aspect_race ?? null;
  const hasActiveRealm = leadFrontier !== null && leadFrontier.status === "Live" && seasonRealm(leadFrontier) !== null;
  return (
    <PageFrame painting={firstVisit ? "dark-plains" : "brooding-plains"} stage={firstVisit} offersInstall>
      <div data-play-page className="play-grid">
        <section className="flex min-w-0 flex-col gap-3">
          <LeadOrState facts={facts} />
          {facts.board && <SourceGaps gaps={facts.gaps} />}
        </section>
        {facts.board && (
          <div className="play-side">
            {leadFrontier && <AspectRacePreview race={leadRace} />}
            {hasActiveRealm && <TodayQuestPanel game={leadFrontier} now={facts.now} />}
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

const AspectRacePreview = ({ race }: { race: HeraldAspectRace | null }) => {
  const finishHeight = race?.finish_height ?? 0;
  const showBars = race !== null && finishHeight > 0;
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
          const height = race?.heights[id] ?? null;
          const share =
            height !== null && finishHeight > 0 ? Math.min(100, Math.round((height / finishHeight) * 100)) : 0;
          return (
            <li
              key={id}
              data-aspect-id={id}
              aria-label={height !== null ? ASPECT_PAGE_WORDS.height(height, finishHeight) : name}
              style={aspectVariables(id) as CSSProperties}
              className="play-aspect"
            >
              {showBars && (
                <div className="play-aspect__tower" aria-hidden="true">
                  {share > 0 && <div className="play-aspect__column" style={{ height: `${share}%` }} />}
                </div>
              )}
              <AspectMark aspect={id} size={38} decorative />
              <span className="play-aspect__name">{name}</span>
              {height !== null && (
                <span className="play-aspect__height">
                  <span className="play-aspect__count">{formatExact(height)}</span>
                  <span className="play-aspect__goal">{`${OF} ${formatExact(finishHeight)}`}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </AppPanel>
  );
};

const questIdOf = (id: number): QuestId | null => questCatalog.find((quest) => quest.id === id)?.id ?? null;

const TodayQuestPanel = ({ game, now }: { game: DirectoryGame; now: number }) => {
  const day = directoryDay(game, now);
  const quest = game.player_state?.today_quest ?? null;
  const questId = quest !== null ? questIdOf(quest.quest_id) : null;
  if (day.day === undefined || quest === null || questId === null) return null;
  const face = dayQuestFace(questId);
  const share = quest.target > 0 ? Math.min(100, Math.round((quest.progress / quest.target) * 100)) : 0;
  return (
    <AppPanel
      title={DAY_BANNER_WORDS.today}
      icon="hourglass"
      cue={<AppChip icon="hourglass">{`${DAY} ${day.day} · ${dayLeftCompact(day.secondsLeft)}`}</AppChip>}
      className="play-today"
    >
      <div className="play-today__quest" data-play-today>
        <span className="play-today__icon" aria-hidden="true">
          <Icon name={face.icon} size={34} />
        </span>
        <div className="play-today__body">
          <span className="play-today__name">{face.name}</span>
          <span className="play-today__summary">
            {DAY_BANNER_WORDS.summary(face.objective, quest.progress, quest.target, quest.labor)}
          </span>
          <div className="play-today__track" aria-hidden="true">
            <div className="play-today__fill" style={{ width: `${share}%` }} />
          </div>
        </div>
      </div>
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
