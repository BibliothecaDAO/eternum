import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { type ThisDeviceState, useThisDevice } from "@/shell/profile/this-device";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { includesKind, type NotificationLevel } from "@bibliothecadao/notifications";
import { useState } from "react";

import { seeLine } from "./opening-store";

/** The moment the offer is recorded under, in the account's told lines: its own once-only response. */
export const SITE_ALERT_OFFER = "site-alert";

/** What turning the alert on came to: delivering, or what stood in its way. */
type AlertOutcome = "on" | "preferences" | "device" | "blocked" | "install" | "unavailable";

/**
 * Turns the site alert on: the account's level raised to the one that carries it, and this device delivering. Each step is
 * an explicit outcome, never assumed: a level that did not save, a permission refused, a registration that failed, a
 * phone that needs the installed app and a browser that cannot show alerts each come back as theirs.
 */
export async function turnOnSiteAlert(input: {
  levelCarries: boolean;
  saveLevel: (level: NotificationLevel) => Promise<boolean>;
  device: { state: ThisDeviceState; toggle: () => Promise<ThisDeviceState> };
}): Promise<AlertOutcome> {
  if (!input.levelCarries && !(await input.saveLevel("important"))) return "preferences";
  const { state } = input.device;
  if (state === "on") return "on";
  if (state === "install" || state === "blocked" || state === "unavailable") return state;
  if (state === "saving") return "device";
  const settled = await input.device.toggle();
  if (settled === "on") return "on";
  return settled === "blocked" || settled === "install" || settled === "unavailable" ? settled : "device";
}

export interface SiteAlertOffer {
  line: string;
  accept: string;
  decline: string;
  /** Why the last try did not turn the alert on; the offer stays until the player answers it. */
  problem: string | null;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * The first Deep entry's offer to turn the site alert on, outside the weekly prompt: made once, to a signed-in player
 * whose account has its preferences, and kept until the player answers it, whether or not any explanatory line shows.
 * Accepting is an answer only once the alert is on; declining records it without changing the account's preferences.
 */
export function useSiteAlertOffer(due: boolean): SiteAlertOffer | undefined {
  const owner = notificationOwnerOf(useIdentitySession().session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const [problem, setProblem] = useState<AlertOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const level = preferences.saved?.level;
  if (!due || !owner || level === undefined) return undefined;
  const levelCarries = includesKind(level, "site-vulnerable");
  if (levelCarries && device.state === "on") return undefined;
  return {
    line: OPENING_WORDS.alertOffer,
    accept: problem === null ? OPENING_WORDS.alertOn : OPENING_WORDS.alertRetry,
    decline: OPENING_WORDS.alertDecline,
    problem: problem === null || problem === "on" ? null : OPENING_WORDS.alertProblem[problem],
    busy,
    onAccept: () => {
      setBusy(true);
      void turnOnSiteAlert({ levelCarries, saveLevel: preferences.save, device })
        .then((outcome) => {
          setProblem(outcome);
          if (outcome === "on") return seeLine(SITE_ALERT_OFFER);
        })
        .finally(() => setBusy(false));
    },
    onDecline: () => void seeLine(SITE_ALERT_OFFER),
  };
}
