import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useInstall } from "@/pwa/install-state";
import type { NotificationLevel } from "@bibliothecadao/notifications";
import { useStandingPrompt } from "../standing-prompts";
import { useThisDevice } from "./this-device";

/** The level a tap on the ask lifts an Off account to: the one Settings offers for the day's push. */
export const ASKED_LEVEL: NotificationLevel = "important";

/**
 * The game's ask to turn alerts on: what its button does; "on" once this device gets the day's push; null when nothing
 * can be asked (signed out, its preferences unread, a device that blocks alerts or cannot show them).
 */
type AlertsAsk = { kind: "remind" | "install"; busy: boolean; act: () => void } | { kind: "on" } | null;

/**
 * Offered while this device would not get the day's push: alerts off on it, or the account's level Off. One tap turns
 * this device on (its permission asked inside the tap) and lifts an Off level to Important, the level Settings offers
 * for the day's push. An iPhone's browser installs first; a device that blocks alerts or cannot show them is not asked.
 */
const useAlertsAsk = (): AlertsAsk => {
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

/** The popup while it stands: what its verb does (it closes the popup too) and its Not now. */
export type AlertsPopupAsk = { kind: "remind" | "install"; act: () => void; notNow: () => void };

export const useAlertsPopup = (clear: boolean): AlertsPopupAsk | null => {
  const ask = useAlertsAsk();
  const asking = ask !== null && ask.kind !== "on" ? ask : null;
  const prompt = useStandingPrompt("alerts-popup", clear && asking !== null);
  if (!prompt.open || !asking) return null;
  return {
    kind: asking.kind,
    act: () => {
      asking.act();
      prompt.close();
    },
    notNow: prompt.close,
  };
};
