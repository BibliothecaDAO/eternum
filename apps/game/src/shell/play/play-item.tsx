import { aspectName, formatCount } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { primeGameEntry } from "@/game-entry-preload";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import type { IconMeaning } from "@/ui/design-system/icon";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AppButton, AppChip, AppGameCard, AppGameName, AppPanel } from "@/ui/design-system/kit/app-elements";
import { AppClockChip, clockLine } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import {
  COUNTDOWN_WORDS,
  PITCH,
  PLAY_WORDS,
  WORDS,
  dayEnds,
  dayLeft,
  gameSpeed,
  phraseText,
} from "@/ui/design-system/kit/words";

import { entryHref } from "../game-links";
import { type DirectoryGame, gameRefOf } from "../herald";
import { directoryDay, seasonDayLabel, seasonDaysOf, seasonPlayerHome, seasonTitle } from "../season";
import { gameStart } from "../season-tab/history-row";
import { resultsHref } from "../season-tab/results-link";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";
import { idleCard, type PlayItem } from "./play-board";

type ItemVerb = { word: string; icon: IconMeaning; to: string; connectFirst?: true; entersGame?: true };

const rehearsalVerbWord = (verb: "play" | "resume", game: DirectoryGame, lead: boolean): string => {
  if (lead) {
    const name = game.name || PLAY_WORDS.rehearsal;
    return verb === "resume" ? COUNTDOWN_WORDS.resumeRehearsal(name) : COUNTDOWN_WORDS.playRehearsal(name);
  }
  return verb === "resume" ? PLAY_WORDS.resumeRehearsal : PLAY_WORDS.joinRehearsal;
};

const verbOf = (item: PlayItem, signedIn: boolean, rehearsal = false, lead = false): ItemVerb | null => {
  const { game } = item;
  switch (item.verb) {
    case "resume":
      return {
        word: rehearsal ? rehearsalVerbWord("resume", game, lead) : WORDS.enterRealm,
        icon: "play",
        to: entryHref(game, "play"),
        entersGame: true,
      };
    case "play": {
      const entry = entryHref(game, "play");
      return signedIn
        ? {
            word: rehearsal ? rehearsalVerbWord("play", game, lead) : WORDS.play,
            icon: "play",
            to: entry,
            entersGame: true,
          }
        : {
            word: rehearsal ? rehearsalVerbWord("play", game, lead) : WORDS.playFree,
            icon: "play",
            to: entry,
            connectFirst: true,
            entersGame: true,
          };
    }
    case "results":
      return { word: WORDS.results, icon: "leaderboard", to: resultsHref(gameRefOf(game)) };
    case null:
      return null;
  }
};

const startOf = (item: PlayItem): string | undefined => (item.verb === "results" ? gameStart(item.game) : undefined);

const ItemFacts = ({ item, now, firstVisit }: { item: PlayItem; now: number; firstVisit: boolean }) => {
  const { game } = item;
  if (item.verb === "results")
    return <AppChip icon="victory">{`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`}</AppChip>;
  if (firstVisit) return <p className="text-app-body text-app-ink">{PITCH}</p>;
  if (game.status !== "Live") return <AppClockChip prefix="starts" at={game.clock.start_main_at} now={now} />;
  return <SeasonDay game={game} now={now} />;
};

const SeasonDay = ({ game, now }: { game: DirectoryGame; now: number }) => {
  const day = directoryDay(game, now);
  const tone = day.tone === "ember" ? "bad" : day.tone === "amber" ? "warn" : undefined;
  return (
    <AppChip icon="hourglass" tone={tone}>
      <span role="timer">{`${phraseText(dayEnds(day.endsAt))} · ${phraseText(dayLeft(day.secondsLeft))}`}</span>
    </AppChip>
  );
};

export const ItemVerbButton = ({
  item,
  signedIn,
  lead,
  rehearsal = false,
}: {
  item: PlayItem;
  signedIn: boolean;
  lead: boolean;
  rehearsal?: boolean;
}) => {
  const requestSignIn = useRequestSignIn();
  if (item.game.error) return <ServiceFailure service="directory" error={item.game.error} />;
  const verb = verbOf(item, signedIn, rehearsal, lead);
  if (!verb) return null;
  const prime = verb.entersGame ? primeGameEntry : () => undefined;
  const press = {
    ...(verb.connectFirst
      ? {
          onClick: () => {
            prime();
            requestSignIn(verb.to);
          },
        }
      : { to: verb.to, onClick: prime }),
    "data-play-verb": item.verb,
  };
  return lead ? (
    <AppButton kind="primary" size="lg" icon={verb.icon} {...press} step>
      {verb.word}
    </AppButton>
  ) : (
    <AppButton kind="secondary" icon={verb.icon} {...press}>
      {verb.word}
    </AppButton>
  );
};

type ItemProps = { item: PlayItem; now: number; signedIn: boolean };

export const LeadCard = ({ item, now, signedIn, className }: ItemProps & { className?: string }) => {
  const age = ageOf("frontier");
  if (item.verb !== "results") {
    return <FrontierHeroCard item={item} now={now} signedIn={signedIn} className={className} />;
  }
  return (
    <div data-play-item={item.key} className={className}>
      <AppGameCard
        age="frontier"
        painting={age.painting}
        size="lead"
        className="h-full"
        title={<AppGameName age="frontier" name={age.name} when={startOf(item)} />}
        facts={<ItemFacts item={item} now={now} firstVisit={false} />}
        verb={<ItemVerbButton item={item} signedIn={signedIn} lead />}
        idle={idleCard([item])}
      />
    </div>
  );
};

const FrontierHeroCard = ({ item, now, signedIn, className }: ItemProps & { className?: string }) => {
  const age = ageOf("frontier");
  const firstVisit = !signedIn && item.verb === "play";
  const { realm, order, aspect } = seasonPlayerHome(item.game);
  const day = directoryDay(item.game, now);
  const dayText = seasonDayLabel(day.day, seasonDaysOf(item.game));
  const heroStyle = aspect !== null ? (aspectVariables(aspect) as CSSProperties) : undefined;
  return (
    <div data-play-item={item.key} className={className}>
      <section
        data-age="frontier"
        data-idle={idleCard([item]) || undefined}
        style={heroStyle}
        className="play-hero h-full"
      >
        <img aria-hidden {...paintingSources(age.painting)} sizes="100vw" alt="" className="play-hero__painting" />
        <div aria-hidden className="play-hero__scrim" />
        <div className="play-hero__top">
          <div className="play-hero__badges">
            {item.game.status === "Live" && dayText !== null && (
              <AppChip icon="sun" tone="gold">
                {`${seasonTitle(item.game)} · ${dayText}`}
              </AppChip>
            )}
            {item.game.status === "Live" && (
              <AppChip icon="people">{formatCount(item.game.player_count, PLAY_WORDS.player)}</AppChip>
            )}
          </div>
          <h2 className="play-hero__title">
            <span className="play-hero__lockup-frame">
              <img src={AGE_LOCKUP.frontier} alt={age.name} className="play-hero__lockup" />
            </span>
          </h2>
        </div>
        <div className="play-hero__plate">
          {realm && (
            <div className="play-hero__realm-row">
              <div className="play-hero__realm-id">
                {aspect !== null && <AspectMark aspect={aspect} size={44} decorative />}
                <div className="flex min-w-0 flex-col">
                  <h3 className="play-hero__realm-name">{realm.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {aspect !== null && <span className="play-hero__aspect-tag">{aspectName(aspect)}</span>}
                    {order && (
                      <span className="play-hero__order-tag">
                        <OrderEmblem order={order.orderId} size={18} />
                        {order.orderName}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="play-hero__chips">
            <ItemFacts item={item} now={now} firstVisit={firstVisit} />
          </div>
          <div className="play-hero__verb">
            <ItemVerbButton item={item} signedIn={signedIn} lead />
            {!item.game.error && (
              <AppButton kind="secondary" size="lg" icon="leaderboard" to="/season">
                {WORDS.seasonRace}
              </AppButton>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

const rehearsalStatusLine = (item: PlayItem, now: number): string => {
  const { game } = item;
  const parts: string[] = [];
  if (item.mine) {
    const { realm } = seasonPlayerHome(game);
    if (realm) parts.push(realm.name);
  }
  if (game.status === "Live") {
    const day = directoryDay(game, now);
    const dayText = seasonDayLabel(day.day, seasonDaysOf(game));
    if (dayText !== null) parts.push(dayText);
    parts.push(formatCount(game.player_count, PLAY_WORDS.player));
  } else {
    parts.push(clockLine("starts", game.clock.start_main_at, now));
    if (game.player_count > 0) parts.push(formatCount(game.player_count, PLAY_WORDS.player));
  }
  return parts.join(" · ");
};

export const RehearsalCard = ({ item, now, signedIn }: ItemProps) => {
  const { game } = item;
  const speed = gameSpeed(game.clock_scale);
  return (
    <AppPanel
      title={game.name || PLAY_WORDS.rehearsal}
      icon="hourglass"
      cue={speed ? <AppChip>{PLAY_WORDS.rehearsalBadge(speed)}</AppChip> : undefined}
    >
      <div className="play-rehearsal" data-play-item={item.key} data-play-rehearsal>
        <p className="text-app-label text-app-muted">{rehearsalStatusLine(item, now)}</p>
        <ItemVerbButton item={item} signedIn={signedIn} lead={false} rehearsal />
      </div>
    </AppPanel>
  );
};
