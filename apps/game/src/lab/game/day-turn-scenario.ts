import { RECORDED_DAY } from "@/ui/features/frontier/rollover/recorded-day-history";
import { dayOf, entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { BiomeType, BiomeTypeToId, getHexesWithinRadius } from "@bibliothecadao/types";

import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { type LabFact, type LabScenario, rowsOf } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The day that ends: day 2 on the card, as on prod when its leading player's summary showed 1 reveal for 35. */
const ENDED_DAY = 1;
/** In the game as the day ends: the session opens this many seconds before it. */
const SECONDS_BEFORE_THE_END = 20;
/** On a phone whose tab sleeps through the end: time to open the map and put the tab away before the day ends. */
const SECONDS_BEFORE_THE_END_ASLEEP = 60;
/** Opened after it ended, as on prod: 8h40m into a 20-hour day. */
const SHARE_OF_THE_NEXT_DAY = (8 * 3_600 + 40 * 60) / (20 * 3_600);
const GRASS = BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

/** In the game as the day ends; asleep through it, the tab in the background (the playtest puts it there); or later. */
type Arrival = "live" | "asleep" | "later";
/**
 * How the player's history answers: at once; only after the moment went on without it; capped short of day 2; with
 * nothing, the player having not played day 2; or with the player's day-3 play too, on another device before this one
 * opened. All but the last hold history as it stood before the player played on in day 3.
 */
type HistoryAnswer = "at-once" | "late" | "capped" | "unplayed" | "played-on";
/** A late history answers this long after the day's end: past the mist and the summary's longest wait. */
const LATE_ANSWER_SECONDS = 25;
/** Herald's largest page: this many newer stories of the player's own leave day 2 outside the read. */
const HISTORY_PAGE = 500;

/**
 * Realm 7's day 2 ending (/lab/game?scenario=day-turn), or ended before the game opened (scenario=day-later), on the
 * spire's game: the player's history is prod's (rollover/recorded-day-history.ts), each event at the same share of the
 * same day on the lab's calendar and the recorded player's events the lab player's. The map opens where the realm stood
 * on day 2, as a route kept from that day does; the land round its day-2 and day-3 sites is revealed. day-turn-slow's
 * Herald answers history only after the moment went on; day-later-short's player played a page of stories late in day
 * 2; day-later-quiet's player did not play day 2; day-later-played-on's player played on in day 3, as on prod, on
 * another device before opening this one (owner, 2026-10-25: the recap shows "until you act"). day-turn-asleep opens a minute before the end, for a phone's tab to sleep
 * through it (owner, 2026-10-25: "eventually I go back to mobile and it doesnt reload the map I get a black screen").
 */
export const dayTurnScenario =
  (arrival: Arrival, answer: HistoryAnswer = "at-once") =>
  (): LabScenario => {
    const spire = spireScenario();
    const rules = readExpeditionRules(spire.store, 1)!;
    const ended = nthDay(rules, ENDED_DAY);
    const next = nthDay(rules, ENDED_DAY + 1);
    const realm = spire.store.require("Structure", { game_id: 1, entity_id: 7 });
    const siteOn = (day: { start: number }) =>
      expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), day.start)!;
    spire.store.applyFacts([...landAround(siteOn(ended), "0x1ab5"), ...landAround(siteOn(next), "0x1ab6")] as never);

    const startsAt =
      arrival === "later"
        ? next.start + Math.round((next.end - next.start) * SHARE_OF_THE_NEXT_DAY)
        : ended.end - (arrival === "asleep" ? SECONDS_BEFORE_THE_END_ASLEEP : SECONDS_BEFORE_THE_END);
    const recorded = recordedHistoryOn(rules, spire.player);
    const beforePlayingOn = recorded.filter((event) => event.block_number < RECORDED_DAY.playedOn.block);
    const history = {
      "at-once": beforePlayingOn,
      late: beforePlayingOn,
      capped: [...pageOfOwnStories(spire.player, ended.end), ...beforePlayingOn],
      unplayed: [],
      "played-on": recorded,
    }[answer];
    return {
      ...spire,
      store: answer === "unplayed" ? withoutArmies(spire.store) : spire.store,
      startsAt,
      opensOn: siteOn(ended),
      history,
      historyAnswersAt: answer === "late" ? ended.end + LATE_ANSWER_SECONDS : undefined,
      // In the game as day 2 ends, the player went through day 1's end the day before (DayDone's mark on this device).
      startDevice:
        arrival === "later"
          ? undefined
          : () => window.localStorage.setItem(`frontier.day-done.1.${spire.player}`, String(ENDED_DAY)),
    };
  };

/** A page of the player's own stories from a minute before `before`, newer on the chain than any recorded one. */
const pageOfOwnStories = (player: string, before: number): HeraldHistoryEvent[] =>
  Array.from({ length: HISTORY_PAGE }, (_, index) => {
    const hash = `0x1ab${(HISTORY_PAGE - index).toString(16)}`;
    return {
      block_number: 1_000_000 - index,
      transaction_index: 0,
      event_index: 0,
      game_id: "1",
      model: "StoryEvent",
      transaction_hash: hash,
      value: {
        game_id: "0x1",
        owner: player,
        entity_id: "0x0",
        tx_hash: hash,
        timestamp: `0x${(before - 60).toString(16)}`,
        story: { TroopsTransferred: { amount: "0x1", source: { Explorer: "0x1" }, target: { Explorer: "0x2" } } },
      },
    };
  });

type Calendar = Parameters<typeof dayOf>[0];

/** The season's day of that index, counted from its first. */
const nthDay = (calendar: Calendar, index: number) => {
  let day = dayOf(calendar, calendar.startMainAt)!;
  while (day.index < index) day = dayOf(calendar, day.end)!;
  return day;
};

/** Prod's recorded history on the lab's calendar, the recorded player's events the lab player's. */
const recordedHistoryOn = (calendar: Calendar, player: string): HeraldHistoryEvent[] => {
  const history: HeraldHistoryEvent[] = JSON.parse(
    JSON.stringify(RECORDED_DAY.history).replaceAll(RECORDED_DAY.player, player),
  );
  return history.map((event) => {
    if (typeof event.value.timestamp !== "string") return event;
    const at = Number(BigInt(event.value.timestamp));
    const recorded = dayOf(RECORDED_DAY.calendar, at)!;
    const lab = nthDay(calendar, recorded.index);
    const share = (at - recorded.start) / (recorded.end - recorded.start);
    const timestamp = Math.floor(lab.start + share * (lab.end - lab.start));
    return { ...event, value: { ...event.value, timestamp: `0x${timestamp.toString(16)}` } };
  });
};

/** The game with no army out on day 2: every row but the armies' and the tiles they stood on. */
const withoutArmies = (store: NativeFactStore): NativeFactStore => {
  const armies = new Set([...store.entries("ExplorerTroops")].map(([, army]) => army.explorer_id));
  const standing = (fact: LabFact) =>
    fact.model === "ExplorerTroops" ||
    (fact.model === "TileOccupancy" && armies.has(BigInt((fact.value as { entity_id: string }).entity_id)));
  const kept = new NativeFactStore();
  kept.applyFacts(rowsOf(store).filter((fact) => !standing(fact)) as never);
  return kept;
};

/** A site and the land four tiles round it, revealed grass, each tile a row of its own. */
const landAround = (site: { col: number; row: number }, keys: string): LabFact[] =>
  [site, ...getHexesWithinRadius(site.col, site.row, 4)].map((hex, index) => ({
    model: "TileOpt",
    key: `${keys}${index.toString(16)}`,
    value: { game_id: 1, alt: false, col: hex.col, row: hex.row, data: GRASS.toString() },
  }));
