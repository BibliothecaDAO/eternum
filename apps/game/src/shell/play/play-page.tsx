import "./play-page.css";

import type { HeraldAspectRace } from "@bibliothecadao/eternum/game-sync";
import {
  aspectName,
  aspects,
  FRIEND_FRAGMENTS,
  FRIENDS_BONUS_FRAGMENTS,
  FRIENDS_LIMIT,
  questCatalog,
  type AspectId,
  type QuestId,
} from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppGameCard, AppLink, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import {
  ASPECT_PAGE_WORDS,
  DAY_BANNER_WORDS,
  PRESEASON_WORDS,
  PROFILE_WORDS,
  SEASON_INVITE_WORDS,
  SHARED_DAYS_WORDS,
  WORDS,
} from "@/ui/design-system/kit/words";
import { dayQuestFace } from "@/ui/features/frontier/day/day-quest-face";

import { PageFrame } from "../frame/page-frame";
import { type DirectoryGame, gameRefOf } from "../herald";
import { Loading } from "../loading";
import { aspectRaceStandings, directoryDay, seasonEnded, seasonPlayerAspect } from "../season";
import { hasSeasonRealm } from "../season-pick";
import { resultsHref } from "../season-tab/results-link";
import { useShareTally } from "../share/own-shares";
import { useRequestSignIn } from "../sign-in/connect";
import { HyperstructureTile } from "./hyperstructure-stage";
import type { PlayItem } from "./play-board";
import { type PlayFacts, type SourceGap, usePlayFacts } from "./play-facts";
import { LeadCard, RehearsalCard } from "./play-item";
import { SeasonCountdown } from "./season-countdown";
import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "./season-invite";

export const PlayPage = () => {
  const facts = usePlayFacts();
  if (isPreseason(facts))
    return (
      <SeasonCountdown
        opening={facts.opening}
        rehearsals={facts.board.rehearsals}
        signedIn={facts.signedIn}
        now={facts.now}
      />
    );
  const firstVisit = !facts.signedIn && facts.board?.lead?.verb === "play";
  const leadFrontier = facts.board?.lead?.game ?? null;
  const leadRace = leadFrontier?.aspect_race ?? null;
  const hasActiveRealm = leadFrontier !== null && leadFrontier.status === "Live" && hasSeasonRealm(leadFrontier);
  const playerAspect = facts.signedIn ? seasonPlayerAspect(leadFrontier) : null;
  return (
    <PageFrame painting={firstVisit ? "dark-plains" : "brooding-plains"} stage={firstVisit} offersInstall>
      <div data-play-page className="play-grid">
        <section className="flex min-w-0 flex-col gap-3">
          <LeadOrState facts={facts} />
          {facts.identityFailure && (
            <ServiceFailure
              service="identity"
              error={facts.identityFailure.error}
              retry={facts.identityFailure.retry}
            />
          )}
          {facts.board && <SourceGaps gaps={facts.gaps} />}
        </section>
        {facts.board &&
          (leadRace !== null ||
            hasActiveRealm ||
            playerAspect !== null ||
            (!facts.signedIn && leadFrontier !== null) ||
            facts.board.results.length > 0 ||
            facts.board.rehearsals.length > 0) && (
            <div className="play-side">
              {facts.board.results.length > 0 && <UnseenResultsPanel items={facts.board.results} />}
              {leadFrontier && leadRace !== null && (
                <AspectRacePreview
                  race={leadRace}
                  members={leadFrontier.aspect_members ?? null}
                  ownAspect={playerAspect}
                />
              )}
              {hasActiveRealm && leadFrontier && <TodayQuestPanel game={leadFrontier} now={facts.now} />}
              {playerAspect !== null ? (
                <PlayInviteStrip />
              ) : (
                !facts.signedIn && leadFrontier !== null && <SignedOutInviteStrip />
              )}
              {facts.board.rehearsals.map((item) => (
                <RehearsalCard key={item.key} item={item} now={facts.now} signedIn={facts.signedIn} />
              ))}
            </div>
          )}
      </div>
    </PageFrame>
  );
};

const isPreseason = (
  facts: PlayFacts,
): facts is PlayFacts & {
  opening: NonNullable<PlayFacts["opening"]>;
  board: NonNullable<PlayFacts["board"]>;
} => facts.opening !== null && facts.board !== undefined && facts.board.lead === null && facts.gaps.length === 0;

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

const AspectRacePreview = ({
  race,
  members,
  ownAspect,
}: {
  race: HeraldAspectRace;
  members: Readonly<Record<AspectId, number>> | null;
  ownAspect: AspectId | null;
}) => {
  const { finishHeight, byAspect } = aspectRaceStandings(race, members);
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
      <div className="flex flex-col gap-3">
        <div className="play-aspects-grid">
          {aspects.map(({ id }) => {
            const row = byAspect[id];
            return (
              <HyperstructureTile
                key={id}
                aspect={id}
                height={row.height}
                finishHeight={finishHeight}
                members={row.members}
                own={ownAspect === id}
                compact
              />
            );
          })}
        </div>
      </div>
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
    <AppPanel title={DAY_BANNER_WORDS.today} icon="hourglass" className="play-today">
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

const UnseenResultsPanel = ({ items }: { items: readonly PlayItem[] }) => (
  <AppPanel title={WORDS.results} icon="victory">
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.key} data-play-item={item.key} className="play-result-row">
          <span className="text-app-body text-app-ink">{seasonEnded(item.game)}</span>
          <AppButton
            kind="secondary"
            icon="leaderboard"
            to={resultsHref(gameRefOf(item.game))}
            data-play-verb="results"
          >
            {WORDS.results}
          </AppButton>
        </div>
      ))}
    </div>
  </AppPanel>
);

const PlayInviteStrip = () => {
  const invite = useSeasonInvite();
  const tally = useShareTally();
  return (
    <AppPanel title={SEASON_INVITE_WORDS.title} icon="people">
      <div className="flex flex-col gap-3" data-play-invite>
        <div className="play-invite">
          <div className="play-invite__text">
            {invite.aspect !== null && (
              <p className="text-app-label text-app-ink">{SEASON_INVITE_WORDS.line(aspectName(invite.aspect))}</p>
            )}
            {tally && tally.friendsPaid > 0 && (
              <p className="text-app-label text-app-gold">
                {`${SHARED_DAYS_WORDS.friendsPaid}: ${SHARED_DAYS_WORDS.ofLimit(tally.friendsPaid)}`}
              </p>
            )}
          </div>
          <CopySeasonInvite invite={invite} size="md" />
        </div>
        <SeasonInviteAlerts invite={invite} />
      </div>
    </AppPanel>
  );
};

const SignedOutInviteStrip = () => {
  const requestSignIn = useRequestSignIn();
  return (
    <AppPanel title={SEASON_INVITE_WORDS.title} icon="people">
      <div className="play-invite" data-play-invite>
        <div className="play-invite__text">
          <p className="text-app-label text-app-gold">
            {PROFILE_WORDS.friendMilestone(FRIEND_FRAGMENTS, FRIENDS_BONUS_FRAGMENTS, FRIENDS_LIMIT)}
          </p>
          <p className="text-app-label text-app-muted">{PRESEASON_WORDS.inviteSignedOut}</p>
        </div>
        <AppButton kind="secondary" size="md" onClick={() => requestSignIn()}>
          {WORDS.signIn}
        </AppButton>
      </div>
    </AppPanel>
  );
};
