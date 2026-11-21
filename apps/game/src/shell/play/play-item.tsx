import { formatCount } from "@bibliothecadao/types";
import { type IconMeaning } from "@/ui/design-system/icon";

import { AppButton, AppChip, AppGameCard, AppGameName, AppRow } from "@/ui/design-system/kit/app-elements";
import { AppClockChip, clockLine } from "@/ui/design-system/kit/clock-chip";
import {
  DAY,
  PITCH,
  PLAY_WORDS,
  WORDS,
  dayEnds,
  dayLeft,
  phraseText,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import { entryHref } from "../game-links";
import { type DirectoryGame, gameRefOf } from "../herald";
import { gameStart, gameTitle } from "../season-tab/history-row";
import { resultsHref } from "../season-tab/results-link";
import { directoryDay } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";
import { idleCard, type PlayItem } from "./play-board";
import { primeGameEntry } from "@/game-entry-preload";

/**
 * An item's verb: where it leads, or, for a signed-out player's Play free, Connect first and then there. A verb into a
 * game starts its files on the press.
 */
type ItemVerb = { word: string; icon: IconMeaning; to: string; connectFirst?: true; entersGame?: true };

/**
 * An item's verb as a route. Signed out, Play free opens Connect over Play, which then enters the season: the doorway
 * would only stop to ask for it.
 */
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

/** A live season's day: when today ends and the time left, how long tomorrow lasts; its players where it is to join. */
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

/** The verb, or where a shard could not be read, the failure in its place. */
const ItemVerbButton = ({ item, signedIn, lead }: { item: PlayItem; signedIn: boolean; lead: boolean }) => {
  const requestSignIn = useRequestSignIn();
  if (item.game.error) return <ServiceFailure service="directory" error={item.game.error} />;
  const verb = verbOf(item, signedIn);
  if (!verb) return null;
  // The verb by its name, whatever its word: what a script presses to take the game's step (the playtest runner).
  // A way into a game starts the game's code and the map's ground on the press: sign-in's minute pays for them.
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

/**
 * The lead: the step the player most likely came for, on its age's painting, its title, its facts and the page's one
 * gold verb (Enter presses it on a desktop). Every item carries its game's key (`data-play-item`), so a press can be
 * named by its game, not by its word. A signed-out player's season says what Frontier is instead of its clock.
 */
export const LeadCard = ({ item, now, signedIn, className }: ItemProps & { className?: string }) => {
  const age = ageOf(item.mode);
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

/** A row's facts as one line of text: what is so and when, then its count. */
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

/** An age's games as rows, in the age's well. */
export const ItemRows = ({ items, now, signedIn }: { items: readonly PlayItem[]; now: number; signedIn: boolean }) => (
  <ul className="app-well">
    {items.map((item) => (
      <ItemRow key={item.key} item={item} now={now} signedIn={signedIn} />
    ))}
  </ul>
);
