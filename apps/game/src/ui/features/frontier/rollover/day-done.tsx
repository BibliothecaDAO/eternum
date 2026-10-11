import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { configManager, type readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useState } from "react";

import { endedHomeArmies, homecomingAtNextDeploy } from "../frontier-home";
import { dayClock, endedDay } from "../hud/day-clock";
import { totalToday } from "../log/today-totals";
import { DayDoneCard } from "./day-done-card";
import { useClosingRankChange } from "./day-ranks";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

const ARMY_MODELS = ["ExplorerTroops", "TileOccupancy", "ArmyProgress", "ResourceBalance"] as const;
const REALM_ART = ["settlement", "city", "kingdom", "empire"] as const;

/**
 * The day-done card over the game's facts, once per ended day on this device, at the first open after it ends: the ended
 * day's totals, the rank it closed at against the day before, the troops its armies took and what Homecoming returns
 * at the next deploy. A day the player did not play (no army ended with it, nothing revealed or cleared) shows no card.
 */
export const DayDone = ({ rules, realm }: { rules: ExpeditionRules; realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const tick = useCurrentDefaultTick();
  const player = useAccountStore((state) => state.account?.address ?? null);
  const { data: stories } = useStoryEvents(350);
  useNativeRevision(ARMY_MODELS);
  const gameId = configManager.getActiveGameId();
  const [seen, markSeen] = useSeenDay(gameId, player);
  const ended = endedDay(rules, now);
  const rank = useClosingRankChange(ended?.day);
  if (!ended || !player || (seen !== null && seen >= ended.day)) return null;
  const totals = totalToday(stories, player, { startMs: ended.start * 1_000, endMs: ended.end * 1_000 });
  const gone = endedHomeArmies(setup.store, realm, rules, now);
  if (gone.length === 0 && totals.reveals === 0 && totals.cleared === 0) return null;
  const returned = homecomingAtNextDeploy(setup.store, realm, rules, now, tick);
  const taken = gone.reduce((sum, army) => sum + Number(army.troops.count / BigInt(RESOURCE_PRECISION)), 0);
  return (
    <DayDoneCard
      endedDay={ended.day}
      realmArt={`/images/realm-card/${REALM_ART[Math.min(realm.base.level, REALM_ART.length - 1)]}.webp`}
      clock={dayClock(rules, now)}
      totals={totals}
      rank={rank}
      armies={gone.length}
      troopsLost={taken - (returned?.sent ?? 0)}
      returned={returned && returned.sent > 0 ? returned : undefined}
      onContinue={() => markSeen(ended.day)}
    />
  );
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
