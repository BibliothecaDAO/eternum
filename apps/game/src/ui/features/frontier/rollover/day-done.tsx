import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type DaySummary, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { configManager, type readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { AlertsPopup } from "../alerts-popup";
import { endedHomeArmies } from "../frontier-home";
import { dayClock, dayToRecap, endedDay, nextDayOf } from "../hud/day-clock";
import { useGloryHeld } from "../log/day-gains";
import { useOwnActs, usePlayerDay } from "../log/player-day";
import { DayDoneCard } from "./day-done-card";
import { useDayShare } from "./day-share-sheet";
import { DayEndScreen } from "./day-end-screen";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

const ARMY_MODELS = ["ExplorerTroops", "TileOccupancy"] as const;

export const DayDone = ({
  rules,
  realm,
  visiting,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  visiting: boolean;
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const player = useAccountStore((state) => state.account?.address ?? null);
  useNativeRevision(ARMY_MODELS);
  const gameId = configManager.getActiveGameId();
  const [seen, markSeen] = useSeenDay(gameId, player);
  const ended = endedDay(rules, now);
  const recap = dayToRecap(rules, now, useOwnActs(player));
  const played = usePlayerDay(player, recap);
  const glory = useGloryHeld(realm);
  const openedAt = useOpenedAt(now);
  const { phase, summaryMissed, landReady, begin, continueDay, showSummary } = useDayEndStore();
  const { onShare, sheet } = useDayShare(realm, recap?.day, played);
  // A day that ended before this realm was founded is none of its player's: a new realm starts on the day it was made.
  const realmsDay = ended !== null && ended.end > Number(realm.base.created_at);
  const unseen = !visiting && player !== null && ended !== null && realmsDay && (seen === null || seen < ended.day);
  // The recap is owed while this device has gone through no day's end since its day.
  const recapOwed = unseen && recap !== null && (seen === null || seen < recap.day);

  const summary = (() => {
    if (!recapOwed || !ended || played.history === "waiting" || played.playedOn) return null;
    const { totals } = played;
    // The realm's armies are read as they stand, so they tell only the day that just ended.
    const justEnded = recap.day === ended.day;
    const gone = justEnded ? endedHomeArmies(setup.store, realm, now) : [];
    // Only a whole history says the day was not played; one that failed or stops short shows the card with dashes.
    if (played.history === "whole" && gone.length === 0 && played.stories.length === 0) return null;
    return (
      <DayDoneCard
        endedDay={recap.day}
        clock={dayClock(rules, now)}
        gains={{ essence: totals.essence, labor: totals.labor, glory }}
        history={played.history}
        stories={played.stories}
        onRetry={played.retry}
        onShare={onShare}
        onContinue={continueDay}
      />
    );
  })();

  const state: DaySummary = summary ? "shown" : unseen && played.history === "waiting" ? "waiting" : "none";
  useEffect(() => {
    showSummary(state);
  }, [state, showSummary]);
  // A day that ended before this session opened was never seen ending: its end plays over the new land once its
  // summary is known, shown or none. One whose moment went on before its history answered opens its summary then.
  const endedBeforeOpening = ended !== null && openedAt !== null && ended.end <= openedAt;
  const arrived = unseen && endedBeforeOpening && state !== "waiting";
  // An arrival begins once a page: past the black's longest hold the player is back on the map, and the camera's move,
  // still due, lands when the block clock catches up. A page booting again begins it afresh.
  const [begunFor, setBegunFor] = useState<number | null>(null);
  const endedDayNumber = ended?.day ?? null;
  const owed = (arrived && begunFor !== endedDayNumber) || (state === "shown" && summaryMissed);
  useEffect(() => {
    if (!owed || phase !== "day") return;
    setBegunFor(endedDayNumber);
    begin("later");
  }, [owed, phase, begin, endedDayNumber]);
  // The day's end is gone through once the camera is on the realm's new site with no summary owed. Marked before, a
  // page booting again in the black would keep the old site and never move.
  const goneThrough = unseen && landReady && !summaryMissed ? ended.day : null;
  useEffect(() => {
    if (goneThrough !== null) markSeen(goneThrough);
  }, [goneThrough, markSeen]);

  // The map is the player's own and clear once no day's end is owed: then the alerts popup may open, while a next day
  // is coming for its push.
  const clear = !visiting && phase === "day" && !unseen && nextDayOf(rules, now) !== null;
  return (
    <>
      <DayEndScreen summary={summary} />
      {summary && sheet}
      <AlertsPopup clear={clear} />
    </>
  );
};

/** The chain time this HUD first read, once the chain clock has a time. */
const useOpenedAt = (now: number): number | null => {
  const opened = useRef<number | null>(null);
  if (opened.current === null && now > 0) opened.current = now;
  return opened.current;
};

/**
 * The last ended day this device has gone through the end of. A convenience in the browser's storage: losing it only
 * plays that day's end again.
 */
const useSeenDay = (gameId: number, player: string | null): [number | null, (day: number) => void] => {
  const key = player ? `frontier.day-done.${gameId}.${player}` : null;
  const [marked, setMarked] = useState<number | null>(null);
  const stored = readSeen(key);
  const seen = marked === null ? stored : Math.max(marked, stored ?? marked);
  const mark = useCallback(
    (day: number) => {
      setMarked(day);
      try {
        if (key) window.localStorage.setItem(key, String(day));
      } catch {
        // Storage refused: the day's end plays again next time, which is harmless.
      }
    },
    [key],
  );
  return [seen, mark];
};

const readSeen = (key: string | null): number | null => {
  try {
    const value = key ? window.localStorage.getItem(key) : null;
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
};
