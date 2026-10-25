import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { type DaySummary, useDayEndStore } from "@/hooks/store/use-day-end-store";
import { configManager, type readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

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
 * them (DayEndScreen). The summary is the day-done card, once per ended day on this device: the ended day's totals (the
 * player's day as Today reads it, usePlayerDay), the rank it closed at against the day before, the troops its armies
 * took and what Homecoming returns at the next deploy. It waits for the player's history to answer (the moment's
 * summary phase waits with it, for a while), and says when that history cannot give the day. A day the player did not
 * play (no army ended with it, nothing revealed or cleared) has none, and a visit to another realm shows none; the
 * moment then passes without it. In the game as the day ends, ExpeditionRollover begins the moment; opening the game
 * after it ended, or once history answers after the moment went on without the summary, this does.
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
        onContinue={() => {
          markSeen(ended.day);
          continueDay();
        }}
      />
    );
  })();

  const state: DaySummary = summary ? "shown" : unseen && played.history === "waiting" ? "waiting" : "none";
  useEffect(() => {
    showSummary(state);
  }, [state, showSummary]);
  // A day that ended before this session opened was never seen ending, nor one whose moment went on before its
  // history answered: its summary opens over the new land.
  const endedBeforeOpening = ended !== null && openedAt !== null && ended.end <= openedAt;
  const owed = state === "shown" && (endedBeforeOpening || summaryMissed);
  useEffect(() => {
    if (owed && phase === "day") begin("later");
  }, [owed, phase, begin]);

  return <DayEndScreen summary={summary} />;
};

/** The chain time this HUD first read, once the chain clock has a time. */
const useOpenedAt = (now: number): number | null => {
  const opened = useRef<number | null>(null);
  if (opened.current === null && now > 0) opened.current = now;
  return opened.current;
};

/**
 * The last ended day this device has shown its card for. A convenience in the browser's storage: losing it only shows
 * the card again.
 */
const useSeenDay = (gameId: number, player: string | null): [number | null, (day: number) => void] => {
  const key = player ? `frontier.day-done.${gameId}.${player}` : null;
  const [marked, setMarked] = useState<number | null>(null);
  const stored = readSeen(key);
  const seen = marked === null ? stored : Math.max(marked, stored ?? marked);
  const mark = (day: number) => {
    setMarked(day);
    try {
      if (key) window.localStorage.setItem(key, String(day));
    } catch {
      // Storage refused: the card shows again next time, which is harmless.
    }
  };
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
