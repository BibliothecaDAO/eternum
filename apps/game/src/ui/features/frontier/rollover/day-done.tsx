import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type DaySummary, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { configManager, type readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { endedHomeArmies, homecomingAtNextDeploy } from "../frontier-home";
import { dayClock, endedDay } from "../hud/day-clock";
import { usePlayerDay } from "../log/player-day";
import { DayDoneCard } from "./day-done-card";
import { DayEndScreen } from "./day-end-screen";
import { useClosingRankChange } from "./day-ranks";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

const ARMY_MODELS = ["ExplorerTroops", "TileOccupancy", "ArmyProgress", "ResourceBalance"] as const;

/**
 * A Frontier day's end in the HUD (use-day-end-store): the ended day's summary over the map, the black and the way past
 * them (DayEndScreen). Each device goes through each ended day's end once: the black, behind which the camera comes onto
 * the realm's new site, and the summary before it when there is one. The summary is the day-done card: the ended day's
 * totals (the player's day as Today reads it, usePlayerDay), the rank it closed at against the day before, the troops
 * its armies took and what Homecoming returns at the next deploy. It waits for the player's history to answer (the
 * moment's summary phase waits with it, for a while), and says when that history cannot give the day. A day the player
 * did not play (no army ended with it, nothing revealed or cleared) has none, and a visit to another realm shows none;
 * the moment then passes without it. In the game as the day ends, ExpeditionRollover begins the moment; opening the
 * game after it ended (owner, 2026-10-25: "it doesnt automatically move me to the new day area"), or once history
 * answers after the moment went on without the summary, this does.
 */
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
  const tick = useCurrentDefaultTick();
  const player = useAccountStore((state) => state.account?.address ?? null);
  useNativeRevision(ARMY_MODELS);
  const gameId = configManager.getActiveGameId();
  const [seen, markSeen] = useSeenDay(gameId, player);
  const ended = endedDay(rules, now);
  const played = usePlayerDay(player, ended);
  const rank = useClosingRankChange(ended?.day);
  const openedAt = useOpenedAt(now);
  const { phase, summaryMissed, begin, continueDay, showSummary } = useDayEndStore();
  const unseen = !visiting && player !== null && ended !== null && (seen === null || seen < ended.day);

  const summary = (() => {
    if (!unseen || !ended || played.history === "waiting") return null;
    const { totals } = played;
    const gone = endedHomeArmies(setup.store, realm, rules, now);
    if (gone.length === 0 && totals.reveals === 0 && totals.cleared === 0) return null;
    const returned = homecomingAtNextDeploy(setup.store, realm, rules, now, tick);
    const taken = gone.reduce((sum, army) => sum + Number(army.troops.count / BigInt(RESOURCE_PRECISION)), 0);
    return (
      <DayDoneCard
        endedDay={ended.day}
        clock={dayClock(rules, now)}
        totals={totals}
        history={played.history}
        onRetry={played.retry}
        rank={rank}
        armies={gone.length}
        troopsLost={taken - (returned?.sent ?? 0)}
        returned={returned && returned.sent > 0 ? returned : undefined}
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
  const owed = arrived || (state === "shown" && summaryMissed);
  useEffect(() => {
    if (owed && phase === "day") begin("later");
  }, [owed, phase, begin]);
  // The day's end is gone through once the screen falls to black with nothing owed: past Continue, or with no summary.
  const goneThrough = unseen && phase === "nightfall" && !summaryMissed ? ended.day : null;
  useEffect(() => {
    if (goneThrough !== null) markSeen(goneThrough);
  }, [goneThrough, markSeen]);

  return <DayEndScreen summary={summary} />;
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
