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

/** This device's answers to the game day asks: how many Not nows, and the game day of the last. */
interface AskMemory {
  notNows: number;
  lastNotNow: string | null;
  notNow: (day: string) => void;
}

export const useAskMemory = create<AskMemory>()(
  persist(
    (set) => ({
      notNows: 0,
      lastNotNow: null,
      notNow: (day) => set((memory) => ({ notNows: memory.notNows + 1, lastNotNow: day })),
    }),
    {
      name: "realms-alerts-ask",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ notNows, lastNotNow }) => ({ notNows, lastNotNow }),
    },
  ),
);

/** The ask a game day shows, and its Not now. */
export type DayAsk = { ask: Extract<AlertsAsk, { act: () => void }>; notNow: () => void };

/**
 * The game day's one ask to turn alerts on, at `moment` (owner's pick, A and B of reports/push-ask-1.md): shown only at
 * this home's moment, so a home with a claim is asked after it and a home without one on the day's summary, never both.
 * A Not now holds both until the next game day; three end them.
 */
export const useDayAsk = (moment: AskMoment, home: { hasClaim: boolean; today: number }): DayAsk | null => {
  const ask = useAlertsAsk();
  const { notNows, lastNotNow, notNow } = useAskMemory();
  const game = getActiveGame();
  if (!ask || ask.kind === "on" || !game) return null;
  const day = `${game.chainId}:${game.gameId}:${home.today}`;
  if (momentOf(home.hasClaim) !== moment || notNows >= NOT_NOW_LIMIT || lastNotNow === day) return null;
  return { ask, notNow: () => notNow(day) };
};

const momentOf = (hasClaim: boolean): AskMoment => (hasClaim ? "claim" : "summary");
