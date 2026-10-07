import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { chooseSeason } from "../season";
import { LORE_LINE } from "../words";
import { AgeCard } from "./age-card";
import { ageState } from "./age-state";
import { AGES, ageOf, paintingSources } from "./ages";
import { ageOfStep, type NextStep } from "./next-step";
import { NextStepCard } from "./next-step-card";
import { type PlayFacts, usePlayFacts } from "./play-facts";
import { SeasonTop } from "./season-top";
import { StateCard } from "./state-card";

/**
 * The Play tab (spec 01, 03, 04): the next step in one card, the other three ages beside it, and on a phone the four
 * ages below as bands. A first visit wears the hero painting and the lore line; desktop sets the card on its age's
 * painting with the season's top five beside it.
 */
export const PlayPage = () => {
  const facts = usePlayFacts();
  const layout = useLayout();
  return <PageFrame>{layout === "phone" ? <PhonePlay facts={facts} /> : <DesktopPlay facts={facts} />}</PageFrame>;
};

const isFirstVisit = (step: NextStep | undefined) => step?.kind === "play" && step.firstVisit;

/** The card, or the directory's failure in its place; the tiles and the tabs keep working either way. */
const HomeCard = ({ facts }: { facts: PlayFacts }) =>
  facts.directory.isError ? (
    <StateCard service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />
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

const DesktopPlay = ({ facts }: { facts: PlayFacts }) => {
  const season = chooseSeason(facts.games, facts.signedIn);
  const firstVisit = isFirstVisit(facts.step);
  const painting = firstVisit ? "dark-plains" : ageOf(ageOfStep(facts.step)).painting;
  return (
    <div className="relative isolate flex flex-col gap-6">
      <DesktopBackdrop painting={painting} />
      <div className="flex min-h-[26rem] items-start justify-between gap-8 pt-6">
        <div className="flex w-[34rem] flex-col gap-4">
          {firstVisit && <p className="font-display text-[44px] leading-[1.1] text-kit-cream">{LORE_LINE}</p>}
          <HomeCard facts={facts} />
        </div>
        {season && (
          <div className="w-[24rem]">
            <SeasonTop season={season} length={5} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {otherAges(facts.step).map((age) => (
          <AgeCard key={age.mode} age={age} {...ageState(age.mode, facts, "full")} size="tall" />
        ))}
      </div>
    </div>
  );
};

/** The card's age painting across the window behind the page, faded into the ground in its lower third. */
const DesktopBackdrop = ({ painting }: { painting: string }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute left-1/2 top-[-1.5rem] -z-10 h-[36rem] w-screen -translate-x-1/2"
  >
    <img {...paintingSources(painting)} sizes="100vw" alt="" className="size-full object-cover object-[50%_40%]" />
    <span className="absolute inset-0 bg-gradient-to-b from-kit-ground/40 via-kit-ground/10 to-kit-ground" />
  </div>
);
