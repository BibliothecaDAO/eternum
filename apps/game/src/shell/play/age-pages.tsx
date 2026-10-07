import { cn } from "@/ui/design-system/atoms/lib/utils";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { Loading } from "../kit";
import { chooseSeason, seasonRealm } from "../season";
import { AgeLabel } from "./age-card";
import { ageState } from "./age-state";
import { type AgeMode, ageOf } from "./ages";
import { paintingSources } from "../paintings";
import { GoButton } from "./go-button";
import { PlayCard, ResumeCard } from "./next-step-card";
import { type PlayFacts, usePlayFacts } from "./play-facts";
import { SeasonTop } from "./season-top";
import { StateCard } from "./state-card";

/** Frontier's page (spec 04): the day and its end with Resume or Play, and the season's top rows with the player's. */
export const FrontierPage = () => {
  const facts = usePlayFacts();
  const layout = useLayout();
  const season = chooseSeason(facts.games, facts.signedIn);
  return (
    <PageFrame back="/" title={ageOf("frontier").name}>
      <AgeFailureOr facts={facts}>
        {season ? (
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[34rem_1fr] lg:items-start lg:gap-8">
            {facts.signedIn && seasonRealm(season) ? (
              <ResumeCard season={season} now={facts.now} />
            ) : (
              <PlayCard season={season} firstVisit={false} now={facts.now} />
            )}
            <SeasonTop season={season} length={layout === "phone" ? 3 : 10} />
          </div>
        ) : (
          <AgeFace mode="frontier" facts={facts} />
        )}
      </AgeFailureOr>
    </PageFrame>
  );
};

/** Eternum's page: the moment it opens and no button before it does (spec 04). */
export const EternumPage = () => <AgePage mode="eternum" />;

/** Dominion: the fourth age as the lore names it; locked, no date, no button (ruled). */
export const DominionPage = () => <AgePage mode="dominion" />;

const AgePage = ({ mode }: { mode: AgeMode }) => {
  const facts = usePlayFacts();
  return (
    <PageFrame back="/" title={ageOf(mode).name}>
      <AgeFailureOr facts={facts}>
        <AgeFace mode={mode} facts={facts} />
      </AgeFailureOr>
    </PageFrame>
  );
};

/** The directory's failure in the page's place, or its waiting state, or the page. */
const AgeFailureOr = ({ facts, children }: { facts: PlayFacts; children: React.ReactNode }) => {
  if (facts.directory.isError)
    return <StateCard service="directory" error={facts.directory.error} retry={() => void facts.directory.refetch()} />;
  if (facts.directory.isPending) return <Loading />;
  return children;
};

/** An age on its own page: its painting, numeral and name, its lore line, its state and its one action, if any. */
const AgeFace = ({ mode, facts }: { mode: AgeMode; facts: PlayFacts }) => {
  const age = ageOf(mode);
  const { chip, action } = ageState(mode, facts, "full");
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_24rem] lg:items-end lg:gap-8">
      <img
        {...paintingSources(age.painting)}
        sizes="(min-width: 1024px) 60vw, 100vw"
        alt=""
        className={cn(
          "h-56 w-full rounded-2xl border border-kit-line object-cover lg:h-[28rem]",
          mode === "dominion" && "brightness-75 grayscale",
        )}
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <AgeLabel numeral={age.numeral} />
          <h2 className="font-ui text-[22px] font-bold text-kit-cream">{age.name}</h2>
        </div>
        <p className="text-[15px] text-kit-muted">{age.lore}</p>
        {chip && <div>{chip}</div>}
        {action && <GoButton {...action} />}
      </div>
    </div>
  );
};
