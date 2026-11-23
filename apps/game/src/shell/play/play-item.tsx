import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, catalogOrder, formatCount, layerName, orderAspect } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { primeGameEntry } from "@/game-entry-preload";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AppButton, AppChip, AppGameCard, AppGameName, AppRow } from "@/ui/design-system/kit/app-elements";
import { AppClockChip, clockLine } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import {
  DAY,
  PITCH,
  PLAY_WORDS,
  WORDS,
  dayEnds,
  dayLeft,
  dayLeftCompact,
  phraseText,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import { entryHref } from "../game-links";
import { type DirectoryGame, gameRefOf } from "../herald";
import { directoryDay, seasonRealm } from "../season";
import { gameStart, gameTitle } from "../season-tab/history-row";
import { resultsHref } from "../season-tab/results-link";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";
import { idleCard, type PlayItem } from "./play-board";

type ItemVerb = { word: string; icon: IconMeaning; to: string; connectFirst?: true; entersGame?: true };

const verbOf = (item: PlayItem, signedIn: boolean): ItemVerb | null => {
  const { game } = item;
  switch (item.verb) {
    case "resume":
      return { word: WORDS.resume, icon: "play", to: entryHref(game, "play"), entersGame: true };
    case "play": {
      const entry = entryHref(game, "play");
      return signedIn
        ? { word: WORDS.play, icon: "play", to: entry, entersGame: true }
        : { word: WORDS.playFree, icon: "play", to: entry, connectFirst: true, entersGame: true };
    }
    case "results":
      return { word: WORDS.results, icon: "leaderboard", to: resultsHref(gameRefOf(game)) };
    case null:
      return null;
  }
};

const titleOf = (item: PlayItem): string => (item.verb === "results" ? gameTitle(item.game) : ageOf(item.mode).name);

const startOf = (item: PlayItem): string | undefined => (item.verb === "results" ? gameStart(item.game) : undefined);

const ItemFacts = ({ item, now, firstVisit }: { item: PlayItem; now: number; firstVisit: boolean }) => {
  const { game } = item;
  if (item.verb === "results")
    return <AppChip icon="victory">{`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`}</AppChip>;
  if (firstVisit) return <p className="text-app-body text-app-ink">{PITCH}</p>;
  if (game.status !== "Live") return <AppClockChip prefix="starts" at={game.clock.start_main_at} now={now} />;
  return <SeasonDay game={game} now={now} withPlayers={item.verb === "play"} />;
};

const SeasonDay = ({ game, now, withPlayers }: { game: DirectoryGame; now: number; withPlayers: boolean }) => {
  const day = directoryDay(game, now);
  const tone = day.tone === "ember" ? "bad" : day.tone === "amber" ? "warn" : undefined;
  return (
    <>
      <AppChip icon="hourglass" tone={tone}>
        <span role="timer">{`${phraseText(dayEnds(day.endsAt))} · ${phraseText(dayLeft(day.secondsLeft))}`}</span>
      </AppChip>
      <AppChip icon="sun">{phraseText(tomorrowLasts(day.tomorrowSeconds))}</AppChip>
      {withPlayers && <AppChip icon="people">{formatCount(game.player_count, PLAY_WORDS.player)}</AppChip>}
    </>
  );
};

const ItemVerbButton = ({ item, signedIn, lead }: { item: PlayItem; signedIn: boolean; lead: boolean }) => {
  const requestSignIn = useRequestSignIn();
  if (item.game.error) return <ServiceFailure service="directory" error={item.game.error} />;
  const verb = verbOf(item, signedIn);
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
  const age = ageOf(item.mode);
  if (item.mode === "frontier" && item.verb !== "results") {
    return <FrontierHeroCard item={item} now={now} signedIn={signedIn} className={className} />;
  }
  return (
    <div data-play-item={item.key} className={className}>
      <AppGameCard
        age={item.mode}
        painting={age.painting}
        size="lead"
        className="h-full"
        title={<AppGameName age={item.mode} name={age.name} when={startOf(item)} />}
        facts={<ItemFacts item={item} now={now} firstVisit={!signedIn && item.verb === "play"} />}
        verb={<ItemVerbButton item={item} signedIn={signedIn} lead />}
        idle={idleCard([item])}
      />
    </div>
  );
};

const FrontierHeroCard = ({ item, now, signedIn, className }: ItemProps & { className?: string }) => {
  const age = ageOf("frontier");
  const firstVisit = !signedIn && item.verb === "play";
  const realmId = seasonRealm(item.game)?.realm_id ?? item.game.player_state?.held_realm_id ?? null;
  const realm = realmId !== null ? canonicalRealm(realmId) : null;
  const order = realm && realm.order !== 0 ? catalogOrder(realm.order) : null;
  const aspect = order ? orderAspect(order.orderId) : null;
  const day = directoryDay(item.game, now);
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
          <h2 className="play-hero__title">
            <img src={AGE_LOCKUP.frontier} alt={age.name} className="play-hero__lockup" />
          </h2>
        </div>
        <div className="play-hero__plate">
          {realm && (
            <div className="play-hero__realm-row">
              <div className="play-hero__realm-id">
                {aspect !== null && <AspectMark aspect={aspect} size={42} decorative />}
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
              {item.game.status === "Live" && day.day !== undefined && (
                <AppChip icon="hourglass">{`${DAY} ${day.day} · ${dayLeftCompact(day.secondsLeft)}`}</AppChip>
              )}
            </div>
          )}
          {realm && item.game.status === "Live" && (
            <div className="play-hero__tiles">
              <div className="play-hero__tile">
                <span className="play-hero__tile-label">{DAY}</span>
                <span className="play-hero__tile-value">
                  <Icon name="sun" size={16} />
                  {day.day ?? "—"}
                </span>
              </div>
              <div className="play-hero__tile">
                <span className="play-hero__tile-label">{layerName(3)}</span>
                <span className="play-hero__tile-value">
                  <Icon name="portal" size={16} />
                  {WORDS.live}
                </span>
              </div>
              <div className="play-hero__tile">
                <span className="play-hero__tile-label">{PLAY_WORDS.player}</span>
                <span className="play-hero__tile-value">
                  <Icon name="people" size={16} />
                  {item.game.player_count}
                </span>
              </div>
            </div>
          )}
          <div className="play-hero__chips">
            <ItemFacts item={item} now={now} firstVisit={firstVisit} />
          </div>
          <div className="play-hero__verb">
            <ItemVerbButton item={item} signedIn={signedIn} lead />
          </div>
        </div>
      </section>
    </div>
  );
};

const ItemLine = ({ item, now }: { item: PlayItem; now: number }) => lineParts(item, now).join(" · ");

const lineParts = (item: PlayItem, now: number): string[] => {
  const { game } = item;
  if (item.verb === "results") return [`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`];
  if (game.status !== "Live") return [clockLine("starts", game.clock.start_main_at, now)];
  const day = directoryDay(game, now);
  return [`${DAY} ${day.day ?? "—"}`, clockLine("ends", day.endsAt, now)];
};

const ItemRow = ({ item, now, signedIn }: ItemProps) => (
  <li data-play-item={item.key}>
    <AppRow
      title={titleOf(item)}
      detail={<ItemLine item={item} now={now} />}
      trail={
        <>
          {item.when === "now" && (
            <AppChip tone="good" live>
              {WORDS.live}
            </AppChip>
          )}
          <ItemVerbButton item={item} signedIn={signedIn} lead={false} />
        </>
      }
    />
  </li>
);

export const ItemRows = ({ items, now, signedIn }: { items: readonly PlayItem[]; now: number; signedIn: boolean }) => (
  <ul className="app-well">
    {items.map((item) => (
      <ItemRow key={item.key} item={item} now={now} signedIn={signedIn} />
    ))}
  </ul>
);
