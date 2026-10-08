import { Navigate } from "react-router-dom";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { chooseSeason } from "../season";
import { BlitzRows, useBlitzJoin } from "../blitz/blitz-pages";
import { OPEN_ON_NEWS } from "../learn/learn-page";
import { NewsRows, newsItems } from "../learn/news";
import { Panel } from "../panel";
import { LEARN_WORDS, LORE_LINE, PLAY_WORDS, WORDS } from "../words";
import { AgeCard } from "./age-card";
import { ageState } from "./age-state";
import { AGES, ageOf } from "./ages";
import { paintingSources } from "../paintings";
import { ageOfStep, type NextStep } from "./next-step";
import { NextStepCard } from "./next-step-card";
import { AgesBand, CommunityBand, ScrollBand } from "./play-bands";
import { type PlayFacts, usePlayFacts } from "./play-facts";
import { SeasonTop } from "./season-top";
import { FailureCard } from "./state-card";

/**
 * The Play tab (spec 01, 03, 04): the next step in one card, the other three ages beside it, and on a phone the four
 * ages below as bands. A first visit wears the hero painting and the lore line. The desktop sets the step on its age's
 * painting with the season and Blitz's games beside it (a first visit is a stage: the painting fills the screen), then
 * scrolls to the four ages, the Scroll and the community.
 */
export const PlayPage = () => {
  const facts = usePlayFacts();
  const { join, refused } = useBlitzJoin(facts.slots.data?.slots);
  const layout = useLayout();
  const firstVisit = isFirstVisit(facts.step);
  const painting = firstVisit ? "dark-plains" : ageOf(ageOfStep(facts.step)).painting;
  return (
    <PageFrame
      painting={painting}
      stage={firstVisit}
      title={firstVisit ? undefined : WORDS.play}
      notice={refused || undefined}
      footer
    >
      {layout === "phone" ? <PhonePlay facts={facts} /> : <DesktopPlay facts={facts} join={join} />}
    </PageFrame>
  );
};

const isFirstVisit = (step: NextStep | undefined) => step?.kind === "play" && step.firstVisit;

/** The card, or the directory's failure in its place; the tiles and the tabs keep working either way. */
const HomeCard = ({ facts }: { facts: PlayFacts }) =>
  facts.directory.isError ? (
    <FailureCard service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />
  ) : (
    <NextStepCard step={facts.step} facts={facts} />
  );

/** The three ages the card does not show, in age order. */
const otherAges = (step: NextStep | undefined) => AGES.filter((age) => age.mode !== ageOfStep(step));

const PhonePlay = ({ facts }: { facts: PlayFacts }) => (
  <div className="flex flex-col gap-3 pb-2">
    {isFirstVisit(facts.step) && <PhoneHero />}
    <HomeCard facts={facts} />
    <div className="grid grid-cols-3 gap-2">
      {otherAges(facts.step).map((age) => (
        <AgeCard key={age.mode} age={age} {...ageState(age.mode, facts, "tile")} action={null} size="tile" />
      ))}
    </div>
    <div className="mt-3 flex flex-col gap-2">
      {AGES.map((age) => (
        <AgeCard key={age.mode} age={age} {...ageState(age.mode, facts, "full")} size="band" />
      ))}
    </div>
  </div>
);

/** The first visit's painting: one lit castle under the storm, the lore line where it fades into the ground. */
const PhoneHero = () => (
  <section className="relative isolate -mx-4 -mt-12 flex h-[250px] items-end overflow-hidden px-4 pb-2 [@media(max-height:700px)]:h-[160px]">
    <img
      {...paintingSources("dark-plains")}
      sizes="100vw"
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover object-[50%_35%]"
    />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-kit-ground/50 via-transparent to-kit-ground" />
    <p className="font-display text-[26px] leading-[1.15] text-kit-cream">{LORE_LINE}</p>
  </section>
);

type Join = ReturnType<typeof useBlitzJoin>["join"];

const DesktopPlay = ({ facts, join }: { facts: PlayFacts; join: Join }) => (
  <div className="flex flex-col gap-16 pb-12">
    {isFirstVisit(facts.step) ? <Stage facts={facts} join={join} /> : <Table facts={facts} join={join} />}
    <AgesBand />
    <ScrollBand />
    <CommunityBand />
  </div>
);

/** B: the step's card, the season beside it, the other three ages under the card, then Blitz's games and the news. */
const Table = ({ facts, join }: { facts: PlayFacts; join: Join }) => {
  const season = chooseSeason(facts.games, facts.signedIn);
  return (
    <div className="grid grid-cols-12 items-start gap-5">
      <div className="col-span-8">
        <HomeCard facts={facts} />
      </div>
      <div className="col-span-4 row-span-3">{season ? <SeasonTop season={season} length={12} /> : <NewsPanel />}</div>
      <div className="col-span-8 grid grid-cols-3 gap-5">
        {otherAges(facts.step).map((age) => (
          <AgeCard key={age.mode} age={age} {...ageState(age.mode, facts, "full")} size="landscape" />
        ))}
      </div>
      <div className="col-span-8 min-[1800px]:col-span-5">
        <BlitzPanel title={PLAY_WORDS.blitzGames} facts={facts} join={join} limit={3} />
      </div>
      {season && (
        <div className="hidden min-[1800px]:col-span-3 min-[1800px]:block">
          <NewsPanel />
        </div>
      )}
    </div>
  );
};

/** A first visit: the painting fills the screen, the lore line and Play free at its foot, the season and the next Blitz games beside them, the four ages along the bottom. */
const Stage = ({ facts, join }: { facts: PlayFacts; join: Join }) => {
  const season = chooseSeason(facts.games, facts.signedIn);
  return (
    <div className="grid min-h-[calc(100vh-3rem)] grid-cols-12 grid-rows-[1fr_auto] gap-6">
      <div className="col-span-5 flex flex-col justify-end gap-5">
        <p className="font-display text-[52px] leading-[1.08] text-kit-cream [text-shadow:0_2px_0_theme(colors.kit.ink/70%),0_0_24px_theme(colors.kit.ink/60%)] min-[1800px]:text-[60px]">
          {LORE_LINE}
        </p>
        <HomeCard facts={facts} />
      </div>
      <div className="col-span-4 col-start-9 flex flex-col gap-5">
        {season && <SeasonTop season={season} length={6} />}
        <BlitzPanel title={PLAY_WORDS.nextBlitz} facts={facts} join={join} limit={2} />
      </div>
      <div className="col-span-12 grid grid-cols-4 gap-5">
        {AGES.map((age) => (
          <AgeCard key={age.mode} age={age} {...ageState(age.mode, facts, "full")} size="landscape" />
        ))}
      </div>
    </div>
  );
};

const BlitzPanel = ({ title, facts, join, limit }: { title: string; facts: PlayFacts; join: Join; limit: number }) => (
  <Panel icon="Pl" title={title}>
    <BlitzRows facts={facts} join={join} limit={limit} />
  </Panel>
);

const NewsPanel = () => (
  <Panel icon="Pc" title={LEARN_WORDS.news}>
    <NewsRows items={newsItems().slice(0, 4)} />
  </Panel>
);

/** The Scroll's address (realms.world links it): Play's Scroll band on the desktop; a phone's Play has no band, so its News on Learn. */
export const ScrollPage = () =>
  useLayout() === "desktop" ? <PlayPage /> : <Navigate to="/learn" state={OPEN_ON_NEWS} replace />;
