import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { useThisDevice } from "@/shell/profile/this-device";
import { OPENING_WORDS } from "@/ui/design-system/kit/words";
import { includesKind } from "@bibliothecadao/notifications";

import type { OpeningMoment } from "./opening";

/**
 * The first Deep line's offer to turn the site alert on, outside the weekly prompt rule: made once, with the line that
 * names the Deep. None for any other line, for a signed-out player, or once the alert already reaches this device.
 * Accepting raises the account's level to the one that carries the alert and turns this device on.
 */
export function useSiteAlertOffer(moment: OpeningMoment | null, gotIt: () => void) {
  const owner = notificationOwnerOf(useIdentitySession().session);
  const preferences = useNotificationPreferences(owner);
  const device = useThisDevice(owner);
  const level = preferences.saved?.level;
  if (moment !== "deep" || !owner || level === undefined) return undefined;
  const levelCarries = includesKind(level, "site-vulnerable");
  if (levelCarries && device.state === "on") return undefined;
  return {
    line: OPENING_WORDS.alertOffer,
    accept: OPENING_WORDS.alertOn,
    onAccept: () => {
      void (async () => {
        if (!levelCarries) await preferences.save("important");
        if (device.state === "off") await device.toggle();
        gotIt();
      })();
    },
  };
}
