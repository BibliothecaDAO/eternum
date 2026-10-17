import { type IconMeaning } from "@/ui/design-system/icon";

import { Button } from "@/ui/design-system/kit/button";
import { Chip } from "@/ui/design-system/kit/chip";
import { Pill } from "@/ui/design-system/kit/pill";
import { ClockLine } from "@/ui/design-system/kit/clock-line";
import { formatAmount } from "@/ui/design-system/kit/amount";

import { DAY } from "@/ui/design-system/kit/words";

import { lobbyId, lobbyTitle } from "../blitz/lobby";
import { useSlotRegistered } from "../blitz/entry";
import { SeatsChip } from "../blitz/seats-chip";
import type { PlaytestSlot } from "../blitz-slot";
import { ClockChip, clockLine } from "../clock-chip";
import { useLayout } from "../frame/layout";
import { StepVerb } from "../frame/step-verb";
import { entryHref } from "../game-links";
import type { DirectoryGame } from "../herald";
import { paintingSources } from "../paintings";
import { gameTitle } from "../season-tab/history-row";
import { resultsHref } from "../season-tab/results-link";
import { directoryDay } from "../season";
import { ServiceFailure } from "../service-failure";
import { signInHref } from "../sign-in/sign-in-route";
import { BLITZ_WORDS, ENTRY_WORDS, PITCH, PLAY_WORDS, WORDS } from "../words";
import { ageOf } from "./ages";
import type { PlayItem } from "./play-board";

type ItemVerb = { word: string; icon: IconMeaning; to: string };

/** The directory game an item stands for; a slot still taking players has none. */
const gameOf = (item: PlayItem): DirectoryGame | undefined =>
  item.source === "game" ? item.game : item.row.kind === "game" ? item.row.game : undefined;

const lobbyHref = (item: PlayItem) => (item.source === "row" ? `/blitz/${lobbyId(item.row)}` : "/");

/**
 * An item's verb as a route. Signed out, Play free opens sign-in directly, which then enters the season: the doorway
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
        : { word: WORDS.playFree, icon: "play", to: signInHref(entry) };
    }
    case "watch":
      return game ? { word: WORDS.watch, icon: "watch", to: entryHref(game, "spectate") } : null;
    case "join":
      return { word: BLITZ_WORDS.join, icon: "play", to: lobbyHref(item) };
    case "refund":
      return { word: ENTRY_WORDS.takeRefund, icon: "refresh", to: lobbyHref(item) };
    case "lobby":
      return { word: BLITZ_WORDS.lobby, icon: "person", to: lobbyHref(item) };
    case "results":
      return game ? { word: WORDS.results, icon: "victory", to: resultsHref(game) } : null;
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

/** What is so of an item, as its chips: live or when, and its seats; a season's day; a result's end. */
const ItemFacts = ({ item, now, firstVisit }: { item: PlayItem; now: number; firstVisit: boolean }) => {
  if (item.source === "row") {
    const { row } = item;
    if (row.action === "refund") return <Pill icon="lock">{ENTRY_WORDS.closed}</Pill>;
    return (
      <>
        {row.startsAt === null ? (
          <>
            <Pill tone="live">{WORDS.live}</Pill>
            {row.kind === "game" && <ClockChip prefix="ends" at={row.game.clock.end_at} now={now} />}
          </>
        ) : row.kind === "slot" ? (
          <ClockChip prefix="closes" at={row.closesAt} now={now} />
        ) : (
          <ClockChip prefix="starts" at={row.startsAt} now={now} />
        )}
        {row.action === "registered" ? <Pill icon="check">{WORDS.joined}</Pill> : <SeatsChip row={row} />}
      </>
    );
  }
  const { game } = item;
  if (item.verb === "results")
    return <Pill icon="victory">{`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`}</Pill>;
  if (item.mode === "eternum")
    return item.verb === "enter" ? (
      <Pill tone="live">{WORDS.live}</Pill>
    ) : (
      <ClockChip prefix="opens" at={game.clock.start_main_at} now={now} />
    );
  if (firstVisit) return <p className="font-body text-base text-kit-cream">{PITCH}</p>;
  if (game.status !== "Live") return <ClockChip prefix="starts" at={game.clock.start_main_at} now={now} />;
  const day = directoryDay(game, now);
  return (
    <>
      <ClockLine
        endsAt={day.endsAt}
        secondsLeft={day.secondsLeft}
        tomorrowSeconds={day.tomorrowSeconds}
        tone={day.tone}
      />
      {item.verb === "play" && (
        <Chip icons={["person"]} value={formatAmount(game.player_count)} label={PLAY_WORDS.players} />
      )}
    </>
  );
};

/** The verb, or where a shard could not be read, the failure in its place. */
const ItemVerbButton = ({ item, signedIn, gold }: { item: PlayItem; signedIn: boolean; gold: boolean }) => {
  const game = gameOf(item);
  if (game?.error) return <ServiceFailure service="directory" error={game.error} />;
  const verb = verbOf(item, signedIn);
  if (!verb) return null;
  return <Button role={gold ? "primary" : "secondary"} word={verb.word} icon={verb.icon} to={verb.to} />;
};

type ItemProps = { item: PlayItem; now: number; signedIn: boolean };

/**
 * The lead: its title, its facts and the one gold verb from the card's top, on its mode's painting under a grade dark
 * enough for its words where they stand (the painting shows through at the card's far side).
 * Every item carries its game's key (`data-play-item`), so a press can be named by its game, not by its word.
 * A signed-out player's season says what Frontier is instead of its clock.
 */
export const LeadCard = ({ item, now, signedIn }: ItemProps) => {
  const desktop = useLayout() === "desktop";
  const verb = <ItemVerbButton item={item} signedIn={signedIn} gold />;
  return (
    <section data-play-item={item.key} className="painted flex rounded-plate">
      <img
        {...paintingSources(ageOf(item.mode).painting)}
        sizes={desktop ? "45vw" : "100vw"}
        alt=""
        className="absolute inset-0 -z-10 size-full object-cover"
      />
      <span className="absolute inset-0 -z-10 bg-gradient-to-r from-kit-ground/95 via-kit-ground/80 to-kit-ground/40" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 lg:p-6">
        <h2 className="font-display text-title leading-none text-kit-cream lg:text-title-lg">{titleOf(item)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ItemFacts item={item} now={now} firstVisit={!signedIn && item.verb === "play"} />
        </div>
        {desktop ? <StepVerb>{verb}</StepVerb> : verb}
      </div>
    </section>
  );
};

/** A row's facts as one line of text, which wraps where chips would overflow: what is so and when, then its count. */
const ItemLine = ({ item, now }: { item: PlayItem; now: number }) =>
  item.source === "row" && item.row.kind === "slot" && item.row.action !== "refund" ? (
    <SlotLine slot={item.row.slot} closesAt={item.row.closesAt} now={now} />
  ) : (
    <span className="font-body text-sm text-kit-muted">{lineParts(item, now).join(" · ")}</span>
  );

const SlotLine = ({ slot, closesAt, now }: { slot: PlaytestSlot; closesAt: number; now: number }) => {
  const registered = useSlotRegistered(slot);
  const count = `${registered === undefined ? "—" : formatAmount(registered)} ${BLITZ_WORDS.registeredUnit}`;
  return <span className="font-body text-sm text-kit-muted">{`${clockLine("closes", closesAt, now)} · ${count}`}</span>;
};

const lineParts = (item: PlayItem, now: number): string[] => {
  if (item.source === "row") {
    const { row } = item;
    if (row.action === "refund") return [ENTRY_WORDS.closed];
    const seats = row.kind === "game" ? `${row.seats.filled}/${row.seats.total}` : null;
    if (row.startsAt === null)
      return [WORDS.live, row.kind === "game" ? clockLine("ends", row.game.clock.end_at, now) : null, seats].filter(
        isText,
      );
    if (row.action === "registered") return [clockLine("starts", row.startsAt, now), WORDS.joined];
    return [clockLine("starts", row.startsAt, now), seats].filter(isText);
  }
  const { game } = item;
  if (item.verb === "results") return [`${PLAY_WORDS.ended} ${clockLine(null, game.clock.end_at, now)}`];
  if (item.mode === "eternum")
    return [item.verb === "enter" ? WORDS.live : clockLine("opens", game.clock.start_main_at, now)];
  if (game.status !== "Live") return [clockLine("starts", game.clock.start_main_at, now)];
  const day = directoryDay(game, now);
  return [`${DAY} ${day.day ?? "—"}`, clockLine("ends", day.endsAt, now)];
};

const isText = (part: string | null): part is string => part !== null;

/** Any other item: its age's painting small, its title and facts, and its verb in outline, or none. */
const ItemRow = ({ item, now, signedIn }: ItemProps) => (
  <li data-play-item={item.key} className="flex items-center gap-3 border-b border-kit-line py-3 last:border-b-0">
    <img
      {...paintingSources(ageOf(item.mode).painting)}
      sizes="48px"
      alt=""
      className="size-12 shrink-0 rounded-thumb object-cover"
    />
    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="truncate font-body text-base font-bold text-kit-cream">{titleOf(item)}</span>
      <ItemLine item={item} now={now} />
    </span>
    <ItemVerbButton item={item} signedIn={signedIn} gold={false} />
  </li>
);

/** A plate of item rows. */
export const ItemRows = ({ items, now, signedIn }: { items: readonly PlayItem[]; now: number; signedIn: boolean }) => (
  <ul className="plate px-3">
    {items.map((item) => (
      <ItemRow key={item.key} item={item} now={now} signedIn={signedIn} />
    ))}
  </ul>
);
