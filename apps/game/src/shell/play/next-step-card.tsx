import type { ReactNode } from "react";

import { getRealmNameById } from "@bibliothecadao/eternum";
import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { DayDial } from "@/ui/design-system/kit/day-dial";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { findOwnEntry, wholeLords } from "@/ui/features/frontier/board/standings";

import { ClockChip } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { resultsHref } from "../season-tab/results-link";
import { ServiceFailure } from "../service-failure";
import { entryHref } from "../game-links";
import { type DirectoryGame, useLeaderboard, useRealmsPlayer } from "../herald";
import { realmStill } from "../mode-art";
import { seasonRealm } from "../season";
import { PITCH, WORDS } from "../words";
import { AgeLabel } from "./age-card";
import { ageState, seasonDay } from "./age-state";
import { ageOf, type AgeMode } from "./ages";
import { paintingSources } from "../paintings";
import { GoButton } from "./go-button";
import type { NextStep } from "./next-step";
import type { PlayFacts } from "./play-facts";
import { LiveChip } from "./state-chip";

/** The home card: the step the table chose, with its age, its picture, its figure and clock, and the one verb. */
export const NextStepCard = ({ step, facts }: { step: NextStep | undefined; facts: PlayFacts }) => {
  switch (step?.kind) {
    case undefined:
      return <WaitingCard />;
    case "resume":
      return <ResumeCard season={step.season} now={facts.now} />;
    case "play":
      return <PlayCard season={step.season} firstVisit={step.firstVisit} now={facts.now} />;
    case "results":
      return <ResultsCard season={step.season} />;
    case "enter":
      return (
        <StepCard
          mode="blitz"
          figure={<LiveChip />}
          line={step.row.kind === "game" && <ClockChip prefix="ends" at={step.row.game.clock.end_at} now={facts.now} />}
          verb={
            step.row.kind === "game" && (
              <GoButton role="primary" word={WORDS.enter} icon="Pl" to={entryHref(step.row.game, "play")} />
            )
          }
        />
      );
    case "blitz":
    case "eternum": {
      const { chip, action } = ageState(step.kind, facts, "full");
      return <StepCard mode={step.kind} line={chip} verb={action && <GoButton {...action} />} />;
    }
  }
};

/**
 * The card's one layout: an optional picture, the age and mode with the figure at the right, one line, the chips,
 * and the verb in the card (home is a hub page: each card keeps its action).
 */
const StepCard = ({
  mode,
  picture,
  figure,
  line,
  chips,
  verb,
}: {
  mode: AgeMode;
  picture?: ReactNode;
  figure?: ReactNode;
  line?: ReactNode;
  chips?: ReactNode;
  verb?: ReactNode;
}) => {
  const age = ageOf(mode);
  // On desktop the age's painting is the page behind the card; a picture of its own would repeat it.
  const desktop = useLayout() === "desktop";
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-kit-line bg-kit-plate p-3.5 shadow-[inset_0_2px_0_theme(colors.kit.gold2/10%)]">
      {picture === undefined ? !desktop && <Painting painting={age.painting} /> : picture}
      <header className="flex items-center gap-2">
        <AgeLabel numeral={age.numeral} />
        <h2 className="font-ui text-[19px] font-bold text-kit-cream">{age.name}</h2>
        <span className="ml-auto">{figure}</span>
      </header>
      {line}
      {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
      {verb}
    </section>
  );
};

const Painting = ({ painting }: { painting: string }) => (
  <img
    {...paintingSources(painting)}
    sizes="(min-width: 1024px) 34rem, 100vw"
    alt=""
    className="h-36 w-full rounded-xl object-cover"
  />
);

/** While the table resolves the card keeps its place and its button; unknown values are dashes. */
const WaitingCard = () => (
  <StepCard
    mode="frontier"
    figure={<DayDial day={undefined} shareLeft={undefined} tone="calm" />}
    line={<ClockLine endsAt={undefined} secondsLeft={undefined} tomorrowSeconds={undefined} tone="calm" />}
    verb={<Button role="primary" word={WORDS.play} icon="Pl" disabled />}
  />
);

/** Frontier's season for a player without a realm in it: Play (Play free on a first visit, under the hero). */
export const PlayCard = ({ season, firstVisit, now }: { season: DirectoryGame; firstVisit: boolean; now: number }) => {
  const clock = seasonDay(season, now);
  return (
    <StepCard
      mode="frontier"
      picture={firstVisit ? null : undefined}
      figure={<Chip icons={["Pp"]} value={formatAmount(season.player_count)} label="Players" />}
      line={
        firstVisit ? (
          <p className="text-[15px] text-kit-cream">{PITCH}</p>
        ) : (
          <ClockLine
            endsAt={clock?.endsAt}
            secondsLeft={clock?.secondsLeft}
            tomorrowSeconds={clock?.tomorrowSeconds}
            tone={clock?.tone ?? "calm"}
          />
        )
      }
      verb={
        season.error ? (
          <Unreadable season={season} />
        ) : (
          <GoButton
            role="primary"
            word={firstVisit ? WORDS.playFree : WORDS.play}
            icon="Pl"
            to={entryHref(season, "play")}
          />
        )
      }
    />
  );
};

/** The player's own season under way: the realm's still, today's dial and clock, the one figure, Resume. */
export const ResumeCard = ({ season, now }: { season: DirectoryGame; now: number }) => {
  const own = useOwnSeasonEntry(season);
  const realm = seasonRealm(season);
  const still = realm && realmStill(realm.level);
  const clock = seasonDay(season, now);
  return (
    <StepCard
      mode="frontier"
      picture={
        still && (
          <div className="relative h-40 overflow-hidden rounded-xl">
            <img src={still} alt="" className="size-full object-cover object-[45%_55%]" />
            <span className="frontier-chip absolute left-2 top-2 h-8 !py-0 !pl-1.5 !pr-3 font-ui text-[15px] font-bold text-kit-cream">
              {own ? <OrderEmblem order={own.order} size={22} /> : <span />}
              {realm && getRealmNameById(realm.realm_id)}
            </span>
          </div>
        )
      }
      figure={<DayDial day={clock?.day} shareLeft={clock?.shareLeft} tone={clock?.tone ?? "calm"} />}
      line={
        <ClockLine
          endsAt={clock?.endsAt}
          secondsLeft={clock?.secondsLeft}
          tomorrowSeconds={clock?.tomorrowSeconds}
          tone={clock?.tone ?? "calm"}
        />
      }
      chips={
        <>
          <Chip icons={["Tp"]} value={own ? `#${own.rank}` : "—"} label={WORDS.season} />
          <Chip icons={["Fl"]} value={formatAmount(own?.sites_cleared.total)} label="Sites cleared" />
          <Chip icons={["Lo"]} value={formatAmount(own && wholeLords(own.rewards.lords))} label="LORDS" />
        </>
      }
      verb={
        season.error ? (
          <Unreadable season={season} />
        ) : (
          <GoButton role="primary" word={WORDS.resume} icon="Pl" to={entryHref(season, "play")} />
        )
      }
    />
  );
};

/** A season the player played has ended and its results are unseen on this device: the card opens them. */
const ResultsCard = ({ season }: { season: DirectoryGame }) => {
  const own = useOwnSeasonEntry(season);
  return (
    <StepCard
      mode="frontier"
      picture={<Painting painting={ageOf("eternum").painting} />}
      figure={<Chip icons={["Tp"]} value={own ? `#${own.rank}` : "—"} label={WORDS.season} />}
      line={<p className="font-ui text-[17px] font-bold text-kit-gold2">{WORDS.seasonOver}</p>}
      verb={<GoButton role="primary" word={WORDS.results} icon="Tp" to={resultsHref(season, false)} />}
    />
  );
};

/** A season whose shard the directory could not read: its card stays, and says so in place of its verb. */
const Unreadable = ({ season }: { season: DirectoryGame }) => (
  <ServiceFailure service="directory" error={season.error} />
);

/** The signed-in player's own row on a Frontier season's board; undefined while it loads or when they have none. */
const useOwnSeasonEntry = (season: DirectoryGame) => {
  const { data: player } = useRealmsPlayer();
  const board = useLeaderboard({ chainId: season.chainId, gameId: season.game_id });
  return board.data?.mode === "frontier" ? findOwnEntry(board.data.entries, player) : undefined;
};
