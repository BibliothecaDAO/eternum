import { formatCount } from "@bibliothecadao/types";
import { type IconMeaning } from "@/ui/design-system/icon";

import { AppButton, AppChip, AppGameCard, AppGameName, AppRow } from "@/ui/design-system/kit/app-elements";
import { AppClockChip, clockLine } from "@/ui/design-system/kit/clock-chip";
import {
  BLITZ_WORDS,
  DAY,
  ENTRY_WORDS,
  PITCH,
  PLAY_WORDS,
  WORDS,
  dayEnds,
  dayLeft,
  phraseText,
  tomorrowLasts,
} from "@/ui/design-system/kit/words";

import { lobbyId, lobbyStart, lobbyTitle } from "../blitz/lobby";
import { SeatsChip } from "../blitz/seats-chip";
import { entryHref } from "../game-links";
import { type DirectoryGame, gameRefOf } from "../herald";
import { gameStart, gameTitle } from "../season-tab/history-row";
import { resultsHref } from "../season-tab/results-link";
import { directoryDay } from "../season";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";
import { idleCard, type PlayItem } from "./play-board";

/** An item's verb: where it leads, or, for a signed-out player's Play free, Connect first and then there. */
type ItemVerb = { word: string; icon: IconMeaning; to: string; connectFirst?: true };

/** The directory game an item stands for; a slot still taking players has none. */
const gameOf = (item: PlayItem): DirectoryGame | undefined =>
  item.source === "game" ? item.game : item.row.kind === "game" ? item.row.game : undefined;

const lobbyHref = (item: PlayItem) => (item.source === "row" ? `/blitz/${lobbyId(item.row)}` : "/");

/**
 * An item's verb as a route. Signed out, Play free opens Connect over Play, which then enters the season: the doorway
 * would only stop to ask for it.
 */
const verbOf = (item: PlayItem, signedIn: boolean): ItemVerb | null => {
  const game = gameOf(item);
  switch (item.verb) {
    case "enter":
      return game ? { word: WORDS.enter, icon: "play", to: entryHref(game, "play") } : null;
    case "resume":
      return game ? { word: WORDS.resume, icon: "play", to: entryHref(game, "play") } : null;
    case "play": {
      if (!game) return null;
      const entry = entryHref(game, "play");
      return signedIn
        ? { word: WORDS.play, icon: "play", to: entry }
        : { word: WORDS.playFree, icon: "play", to: entry, connectFirst: true };
    }
    case "watch":
      return game ? { word: WORDS.watch, icon: "watch", to: entryHref(game, "spectate") } : null;
    case "join":
      return { word: BLITZ_WORDS.join, icon: "plus", to: lobbyHref(item) };
    case "refund":
      return { word: ENTRY_WORDS.takeRefund, icon: "refresh", to: lobbyHref(item) };
    case "lobby":
      return { word: BLITZ_WORDS.lobby, icon: "people", to: lobbyHref(item) };
    case "results":
      return game ? { word: WORDS.results, icon: "leaderboard", to: resultsHref(gameRefOf(game)) } : null;
    case null:
      return null;
  }
};

/** An item's title: a Blitz by its start ("Blitz 19:15"), a finished game the same way, a season by its mode. */
const titleOf = (item: PlayItem): string => {
  if (item.source === "row") return lobbyTitle(item.row);
  if (item.verb === "results") return gameTitle(item.game);
  return ageOf(item.mode).name;
};

/** One game's start, where the item is one game of its age (a Blitz, a finished game); a season has none. */
const startOf = (item: PlayItem): string | undefined => {
  if (item.source === "row") return lobbyStart(item.row);
  if (item.verb === "results") return gameStart(item.game);
  return undefined;
};

/** What is so of an item, as its chips: live or when, and its seats; a season's day; a result's end. */
const ItemFacts = ({ item, now, firstVisit }: { item: PlayItem; now: number; firstVisit: boolean }) => {
  if (item.source === "row") {
    const { row } = item;
    if (row.action === "refund") return <AppChip icon="lock">{ENTRY_WORDS.closed}</AppChip>;
    return (
      <>
        {row.startsAt === null ? (
          <>
            <AppChip tone="good" live>
              {WORDS.live}
            </AppChip>
            {row.kind === "game" && <AppClockChip prefix="ends" at={row.game.clock.end_at} now={now} />}
          </>
        ) : row.kind === "slot" ? (
          <AppClockChip prefix="closes" at={row.closesAt} now={now} />
        ) : (
          <AppClockChip prefix="starts" at={row.startsAt} now={now} />
        )}
        {row.action === "registered" ? <AppChip icon="check">{WORDS.joined}</AppChip> : <SeatsChip row={row} />}
      </>
    );
  }
  const { game } = item;
  if (item.verb === "results")
    return <AppChip icon="victory">{`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`}</AppChip>;
  if (item.mode === "eternum")
    return item.verb === "enter" ? (
      <AppChip tone="good" live>
        {WORDS.live}
      </AppChip>
    ) : (
      <AppClockChip prefix="opens" at={game.clock.start_main_at} now={now} />
    );
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
  const game = gameOf(item);
  if (game?.error) return <ServiceFailure service="directory" error={game.error} />;
  const verb = verbOf(item, signedIn);
  if (!verb) return null;
  const press = verb.connectFirst ? { onClick: () => requestSignIn(verb.to) } : { to: verb.to };
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
  if (item.source === "row") {
    const { row } = item;
    if (row.action === "refund") return [ENTRY_WORDS.closed];
    if (row.kind === "slot") return [clockLine("closes", row.closesAt, now)];
    const seats = `${row.seats.filled}/${row.seats.total}`;
    // A live row's Live is its chip.
    if (row.startsAt === null) return [clockLine("ends", row.game.clock.end_at, now), seats];
    if (row.action === "registered") return [clockLine("starts", row.startsAt, now), WORDS.joined];
    return [clockLine("starts", row.startsAt, now), seats];
  }
  const { game } = item;
  if (item.verb === "results") return [`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`];
  if (item.mode === "eternum")
    return [item.verb === "enter" ? WORDS.live : clockLine("opens", game.clock.start_main_at, now)];
  if (game.status !== "Live") return [clockLine("starts", game.clock.start_main_at, now)];
  const day = directoryDay(game, now);
  return [`${DAY} ${day.day ?? "—"}`, clockLine("ends", day.endsAt, now)];
};

/** Any other item: its title and line, a slot's registered count, its live mark, and its verb, or none. */
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
          {item.source === "row" && item.row.kind === "slot" && item.row.action !== "refund" && (
            <SeatsChip row={item.row} />
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
