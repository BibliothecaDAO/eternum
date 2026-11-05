import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useInstall } from "@/pwa/install-state";
import type { NotificationLevel } from "@bibliothecadao/notifications";
import { useThisDevice } from "./this-device";

/** The level a tap on the ask lifts an Off account to: the one Settings offers for the day's push. */
export const ASKED_LEVEL: NotificationLevel = "important";

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
    if (levelOff) void preferences.save(ASKED_LEVEL);
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

/** The popup asks a device at most once in this long, counted from the last time it was shown. */
const ASK_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

/** Three Not nows on this device end the popup; Settings keeps the switch. */
const NOT_NOW_LIMIT = 3;

/** This device's popup: how many Not nows, and when it was last shown (ms), null before it ever was. */
interface AskMemory {
  notNows: number;
  shownAt: number | null;
  shown: (at: number) => void;
  notNow: () => void;
}

/** Where this device keeps the popup's memory, shared by every tab of the game. */
const ASK_MEMORY_KEY = "realms-alerts-ask";

export const useAskMemory = create<AskMemory>()(
  persist(
    (set) => ({
      notNows: 0,
      shownAt: null,
      shown: (at) => set({ shownAt: at }),
      notNow: () => set((memory) => ({ notNows: memory.notNows + 1 })),
    }),
    {
      name: ASK_MEMORY_KEY,
      // Version 0 kept each game's asked day; its Not nows still count.
      version: 1,
      migrate: (stored) => ({ notNows: (stored as { notNows?: number } | null)?.notNows ?? 0, shownAt: null }),
      storage: createJSONStorage(() => localStorage),
      partialize: ({ notNows, shownAt }) => ({ notNows, shownAt }),
    },
  ),
);

/** The popup while it stands: what its verb does (it closes the popup too) and its Not now. */
export type AlertsPopupAsk = { kind: "remind" | "install"; act: () => void; notNow: () => void };

/**
 * The popup that asks for alerts (owner's pick A of reports/push-popup-1.md): once `clear` (the player's own map with no
 * day's end owed), it opens on a device that can be asked, at most once a week from the last time it showed, and stands
 * on its page until answered or until the map stops being clear (a day's end, another realm), which closes it as shown.
 * Three Not nows end it. The memory is the device's: another tab's showing or Not now counts here at once.
 */
export const useAlertsPopup = (clear: boolean): AlertsPopupAsk | null => {
  const ask = useAlertsAsk();
  const { notNows, shownAt, shown, notNow } = useAskMemory();
  const [open, setOpen] = useState(false);
  useMemoryOfOtherTabs();
  const asking = ask !== null && ask.kind !== "on" ? ask : null;
  const due = asking !== null && isDue({ notNows, shownAt });
  useEffect(() => {
    if (open && !clear) setOpen(false);
    // Decided on the device's memory as stored now, whatever this tab last read.
    if (open || !clear || !due || !isDue(storedMemory())) return;
    setOpen(true);
    shown(Date.now());
  }, [clear, due, open, shown]);
  if (!open || !clear || !asking) return null;
  return {
    kind: asking.kind,
    act: () => {
      asking.act();
      setOpen(false);
    },
    notNow: () => {
      storedMemory();
      notNow();
      setOpen(false);
    },
  };
};

const isDue = ({ notNows, shownAt }: Pick<AskMemory, "notNows" | "shownAt">) =>
  notNows < NOT_NOW_LIMIT && (shownAt === null || Date.now() - shownAt >= ASK_EVERY_MS);

/** The memory as this device stores it now, read into the store first (localStorage reads at once). */
const storedMemory = () => {
  void useAskMemory.persist.rehydrate();
  return useAskMemory.getState();
};

/** Another tab's write to the popup's memory reaches this one: the stored memory is read again. */
const useMemoryOfOtherTabs = () => {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ASK_MEMORY_KEY) storedMemory();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
};
