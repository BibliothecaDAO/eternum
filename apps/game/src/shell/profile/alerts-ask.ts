import { useEffect, useState } from "react";
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

/** This device's game day asks: how many Not nows, and the day each game last asked on ("0xa:1" → 12). */
interface AskMemory {
  notNows: number;
  asked: Record<string, number>;
  offer: (game: string, day: number) => void;
  notNow: () => void;
}

export const useAskMemory = create<AskMemory>()(
  persist(
    (set) => ({
      notNows: 0,
      asked: {},
      offer: (game, day) => set((memory) => ({ asked: { ...memory.asked, [game]: day } })),
      notNow: () => set((memory) => ({ notNows: memory.notNows + 1 })),
    }),
    {
      name: "realms-alerts-ask",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ notNows, asked }) => ({ notNows, asked }),
    },
  ),
);

/** The ask a game day shows, the day its push tells of, and its Not now. */
export type DayAsk = { ask: Extract<AlertsAsk, { act: () => void }>; nextDay: number; notNow: () => void };

/**
 * The game day's one ask to turn alerts on, at `moment` (owner's pick, A and B of reports/push-ask-1.md): a home with a
 * claim is asked after it and a home without one on the day's summary, and only while a next day is coming. Each game
 * day asks once on this device, at whichever moment comes first: once shown, the ask stands on its page until answered,
 * and no other page, reopened sheet or moment asks again that day. Three Not nows end the asking.
 */
export const useDayAsk = (moment: AskMoment, home: { hasClaim: boolean; nextDay: number | null }): DayAsk | null => {
  const ask = useAlertsAsk();
  const memory = useAskMemory();
  const active = getActiveGame();
  const [offered, setOffered] = useState<string | null>(null);
  const game = active && `${active.chainId}:${active.gameId}`;
  const today = home.nextDay === null ? null : home.nextDay - 1;
  const day = game && today !== null ? `${game}:${today}` : null;
  const askable = ask !== null && ask.kind !== "on" && momentOf(home.hasClaim) === moment;
  const unasked = memory.notNows < NOT_NOW_LIMIT && game !== null && memory.asked[game] !== today;
  const shown = askable && day !== null && (offered === day || (offered === null && unasked));
  const { offer } = memory;
  useEffect(() => {
    if (!shown || offered === day || !game || today === null) return;
    setOffered(day);
    offer(game, today);
  }, [shown, offered, day, game, today, offer]);
  if (!shown || !ask || home.nextDay === null) return null;
  return {
    ask,
    nextDay: home.nextDay,
    notNow: () => {
      memory.notNow();
      setOffered("answered");
    },
  };
};

const momentOf = (hasClaim: boolean): AskMoment => (hasClaim ? "claim" : "summary");
