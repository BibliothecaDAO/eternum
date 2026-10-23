import { RECORDED_DAY } from "@/ui/features/frontier/rollover/recorded-day-history";
import { dayOf, entityHomeNamespace, expeditionRealmSite, readExpeditionRules } from "@bibliothecadao/eternum";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";
import { BiomeType, BiomeTypeToId, getHexesWithinRadius } from "@bibliothecadao/types";

import { nativeTilePackingConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { LabFact, LabScenario } from "./lab-chain";
import { spireScenario } from "./spire-scenario";

/** The day that ends: day 2 on the card, as on prod when its leading player's summary showed 1 reveal for 35. */
const ENDED_DAY = 1;
/** In the game as the day ends: the session opens this many seconds before it. */
const SECONDS_BEFORE_THE_END = 20;
/** Opened after it ended, as on prod: 8h40m into a 20-hour day. */
const SHARE_OF_THE_NEXT_DAY = (8 * 3_600 + 40 * 60) / (20 * 3_600);
const GRASS = BigInt(BiomeTypeToId[BiomeType.Grassland]) * BigInt(nativeTilePackingConstants.BIOME_SCALE);

type Arrival = "live" | "later";

/**
 * Realm 7's day 2 ending (/lab/game?scenario=day-turn), or ended before the game opened (scenario=day-later), on the
 * spire's game: the player's history is prod's (rollover/recorded-day-history.ts), each event at the same share of the
 * same day on the lab's calendar and the recorded player's events the lab player's. The map opens where the realm stood
 * on day 2, as a route kept from that day does; the land round its day-2 and day-3 sites is revealed.
 */
export const dayTurnScenario = (arrival: Arrival) => (): LabScenario => {
  const spire = spireScenario();
  const rules = readExpeditionRules(spire.store, 1)!;
  const ended = nthDay(rules, ENDED_DAY);
  const next = nthDay(rules, ENDED_DAY + 1);
  const realm = spire.store.require("Structure", { game_id: 1, entity_id: 7 });
  const siteOn = (day: { start: number }) =>
    expeditionRealmSite(rules, entityHomeNamespace(realm.entity_id), day.start)!;
  spire.store.applyFacts([...landAround(siteOn(ended), "0x1ab5"), ...landAround(siteOn(next), "0x1ab6")] as never);
  // In the game as day 2 ends, the player read day 1's summary the day before (DayDone's mark on this device).
  if (arrival === "live") window.localStorage.setItem(`frontier.day-done.1.${spire.player}`, String(ENDED_DAY));
  return {
    ...spire,
    startsAt:
      arrival === "live"
        ? ended.end - SECONDS_BEFORE_THE_END
        : next.start + Math.round((next.end - next.start) * SHARE_OF_THE_NEXT_DAY),
    opensOn: siteOn(ended),
    history: recordedHistoryOn(rules, spire.player),
  };
};

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

/** A site and the land four tiles round it, revealed grass, each tile a row of its own. */
const landAround = (site: { col: number; row: number }, keys: string): LabFact[] =>
  [site, ...getHexesWithinRadius(site.col, site.row, 4)].map((hex, index) => ({
    model: "TileOpt",
    key: `${keys}${index.toString(16)}`,
    value: { game_id: 1, alt: false, col: hex.col, row: hex.row, data: GRASS.toString() },
  }));
