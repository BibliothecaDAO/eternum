import type { ReactNode } from "react";

import { canEnterGame, isGameOver } from "@/runtime/world/directory";
import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { formatClockTime } from "@/ui/design-system/kit/time";
import { DAY } from "@/ui/design-system/kit/words";
import { dayClock } from "@/ui/features/frontier/hud/day-clock";

import { type BlitzRow, leadBlitzRow } from "../blitz-rows";
import { ClockChip, clockLine } from "../clock-chip";
import { entryHref } from "../game-links";
import type { DirectoryGame } from "../herald";
import { chooseSeason, seasonRealm } from "../season";
import { WORDS } from "../words";
import type { AgeMode } from "./ages";
import type { PlayFacts } from "./play-facts";
import { LiveChip, StateChip } from "./state-chip";

/** An age card's one action: its verb, its icon and where it leads. */
export type AgeAction = { word: string; icon: IconCode; to: string; role: "primary" | "secondary" };

/** What an age card shows of its age now: one chip and at most one action; a tile has room for the chip alone. */
type AgeState = { chip: ReactNode; action: AgeAction | null };

const NOTHING: AgeState = { chip: null, action: null };

/** Frontier's day, from the season's clock: "Day 12". */
export const seasonDay = (season: DirectoryGame, now: number) =>
  season.expedition
    ? dayClock({ epochSeconds: season.expedition.epoch_seconds, startMainAt: season.clock.start_main_at }, now)
    : undefined;

const blitzAction = (row: BlitzRow): AgeAction | null => {
  if (row.kind === "slot")
    return row.action === "join" ? { word: WORDS.join, icon: "Pl", to: "/blitz", role: "primary" } : null;
  if (row.action === "enter")
    return { word: WORDS.enter, icon: "Pl", to: entryHref(row.game, "play"), role: "primary" };
  if (row.action === "spectate")
    return { word: WORDS.watch, icon: "Wc", to: entryHref(row.game, "spectate"), role: "secondary" };
  return null;
};

const blitzState = ({ blitz, now }: PlayFacts, tile: boolean): AgeState => {
  const lead = leadBlitzRow(blitz);
  if (!lead) return NOTHING;
  const chip =
    lead.startsAt === null ? (
      <LiveChip />
    ) : lead.action === "registered" ? (
      <StateChip icon="Ok" text={formatClockTime(lead.startsAt)} />
    ) : tile ? (
      <StateChip icon="Hg" text={formatClockTime(lead.startsAt)} />
    ) : (
      <ClockChip prefix="starts" at={lead.startsAt} now={now} />
    );
  return { chip, action: blitzAction(lead) };
};

const frontierState = ({ games, signedIn, now }: PlayFacts): AgeState => {
  const season = chooseSeason(games, signedIn);
  if (!season) return NOTHING;
  const day = seasonDay(season, now)?.day;
  const action: AgeAction | null = season.error
    ? null
    : {
        word: signedIn && seasonRealm(season) ? WORDS.resume : WORDS.play,
        icon: "Pl",
        to: entryHref(season, "play"),
        role: "primary",
      };
  return { chip: <StateChip icon="Hg" text={`${DAY} ${day ?? "—"}`} />, action };
};

const eternumState = ({ games, now }: PlayFacts, tile: boolean): AgeState => {
  const next = games
    .filter((game) => game.mode === "eternum" && !isGameOver(game))
    .toSorted((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];
  if (!next) return NOTHING;
  if (canEnterGame(next))
    return {
      chip: <LiveChip />,
      action: { word: WORDS.enter, icon: "Pl", to: entryHref(next, "play"), role: "primary" },
    };
  const chip = tile ? (
    <StateChip icon="Cl" text={clockLine(null, next.clock.start_main_at, now)} />
  ) : (
    <ClockChip prefix="opens" at={next.clock.start_main_at} now={now} />
  );
  return { chip, action: null };
};

/** Each age's live state, read from the Play tab's facts. Dominion is locked: no date, no button (ruled). */
export const ageState = (mode: AgeMode, facts: PlayFacts, size: "tile" | "full"): AgeState => {
  switch (mode) {
    case "blitz":
      return blitzState(facts, size === "tile");
    case "frontier":
      return frontierState(facts);
    case "eternum":
      return eternumState(facts, size === "tile");
    case "dominion":
      return { chip: <StateChip icon="Lk" />, action: null };
  }
};
