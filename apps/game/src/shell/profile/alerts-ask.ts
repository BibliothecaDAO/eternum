import { useCallback, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useInstall } from "@/pwa/install-state";
import { getActiveGame } from "@/runtime/world/store";
import { useThisDevice } from "./this-device";

/**
 * The game's ask to turn alerts on: what its button does; "on" once this device gets the day's push; null when nothing
 * can be asked (signed out, its preferences unread, a device that blocks alerts or cannot show them).
 */
export type AlertsAsk = { kind: "remind" | "install"; busy: boolean; act: () => void } | { kind: "on" } | null;

/**
 * Offered while this device would not get the day's push: alerts off on it, or the account's level Off. One tap turns
 * this device on (its permission asked inside the tap) and lifts an Off level to Important, the level Settings offers
 * for the day's push. An iPhone's browser installs first; a device that blocks alerts or cannot show them is not asked.
 */
export const useAlertsAsk = (): AlertsAsk => {
  const owner = notificationOwnerOf(useIdentitySession().session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const { install } = useInstall();
  if (!owner || (preferences.status !== "ready" && preferences.status !== "saving")) return null;
  const levelOff = (preferences.saved?.level ?? "off") === "off";
  const raiseLevel = () => {
    if (levelOff) void preferences.save("important");
  };
  switch (device.state) {
    case "install":
      return { kind: "install", busy: false, act: () => void install() };
    case "saving":
      return { kind: "remind", busy: true, act: () => {} };
    case "off":
      return {
        kind: "remind",
        busy: preferences.status === "saving",
        act: () => {
          void device.toggle();
          raiseLevel();
        },
      };
    case "on":
      return levelOff ? { kind: "remind", busy: preferences.status === "saving", act: raiseLevel } : { kind: "on" };
    default:
      return null;
  }
};

/** A game day's moment to ask: after the day's claim for a home with one, on the day's summary for a home without. */
type AskMoment = "claim" | "summary";

/** Three Not nows on this device end the game day asks; Settings keeps the switch. */
const NOT_NOW_LIMIT = 3;

/**
 * This device's game day asks: how many Not nows, and each game's last asked day ("0xa:1" → day 12) with the page that
 * asked it, which keeps its ask until answered (null once answered).
 */
interface AskMemory {
  notNows: number;
  asked: Record<string, { day: number; host: string | null }>;
  offer: (game: string, day: number, host: string) => void;
  notNow: (game: string, day: number) => void;
}

export const useAskMemory = create<AskMemory>()(
  persist(
    (set) => ({
      notNows: 0,
      asked: {},
      // The first page to show the day's ask keeps it; drawing it again records nothing.
      offer: (game, day, host) =>
        set((memory) =>
          memory.asked[game]?.day === day ? memory : { asked: { ...memory.asked, [game]: { day, host } } },
        ),
      notNow: (game, day) =>
        set((memory) => ({ notNows: memory.notNows + 1, asked: { ...memory.asked, [game]: { day, host: null } } })),
    }),
    {
      name: "realms-alerts-ask",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ notNows, asked }) => ({ notNows, asked }),
    },
  ),
);

/**
 * The ask a game day shows, the day its push tells of, its Not now, and `offer`, which the ask calls once drawn: only a
 * shown ask spends the day.
 */
export type DayAsk = {
  ask: Extract<AlertsAsk, { act: () => void }>;
  nextDay: number;
  offer: () => void;
  notNow: () => void;
};

/**
 * The game day's one ask to turn alerts on, at `moment` (owner's pick, A and B of reports/push-ask-1.md): a home with a
 * claim is asked after it and a home without one on the day's summary, and only while a next day is coming. Each game
 * day asks once on this device, read each time against the stored day: the page that drew the ask keeps it until
 * answered, no other page, reopened sheet or moment asks that day, and the next day asks again, on a page still open
 * too. Three Not nows end the asking.
 */
export const useDayAsk = (moment: AskMoment, home: { hasClaim: boolean; nextDay: number | null }): DayAsk | null => {
  const ask = useAlertsAsk();
  const { notNows, asked, offer: remember, notNow: answer } = useAskMemory();
  // This page, as the memory names the one that drew the day's ask.
  const [host] = useState(() => crypto.randomUUID());
  const active = getActiveGame();
  const game = active && `${active.chainId}:${active.gameId}`;
  const today = home.nextDay === null ? null : home.nextDay - 1;
  const offer = useCallback(() => {
    if (game && today !== null) remember(game, today, host);
  }, [remember, game, today, host]);
  if (!ask || ask.kind === "on" || momentOf(home.hasClaim) !== moment) return null;
  if (!game || today === null || home.nextDay === null || notNows >= NOT_NOW_LIMIT) return null;
  const last = asked[game];
  if (last?.day === today && last.host !== host) return null;
  return { ask, nextDay: home.nextDay, offer, notNow: () => answer(game, today) };
};

const momentOf = (hasClaim: boolean): AskMoment => (hasClaim ? "claim" : "summary");
