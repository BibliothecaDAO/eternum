import { useState, useSyncExternalStore } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useInstall } from "@/pwa/pwa-install-control";
import { usePwaUpdate } from "@/pwa/pwa-update-prompt";
import { appQueryClient } from "@/runtime/query-client";
import { Notice } from "@/ui/design-system/kit/notice";
import { OFFLINE, TRY_AGAIN } from "@/ui/design-system/kit/words";

import { APP_STATE_WORDS } from "../words";

/** Later on the install notice puts it off for a week, on this browser only. */
const INSTALL_LATER_KEY = "realms.install-later-until";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

const useOnline = () =>
  useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );

const installPutOff = () => {
  try {
    return Number(localStorage.getItem(INSTALL_LATER_KEY) ?? 0) > Date.now();
  } catch {
    return false;
  }
};

const putInstallOff = () => {
  try {
    localStorage.setItem(INSTALL_LATER_KEY, String(Date.now() + WEEK_MS));
  } catch {
    // A refused write only shows the notice again.
  }
};

/**
 * The app's one notice (spec 14), first that applies: Offline (the last values stay, Try again reads them anew), an
 * update ready, or Install (Later puts it off a week). PageFrame places it above the foot row on a phone and bottom centre on desktop; a game
 * never shows it, so an update waits until Exit.
 */
export const useAppNotice = () => {
  const online = useOnline();
  const { session } = useIdentitySession();
  const update = usePwaUpdate();
  const install = useInstall();
  const [installLater, setInstallLater] = useState(installPutOff);
  const [updating, setUpdating] = useState(false);

  if (!online)
    return (
      <Notice icon="Of" line={OFFLINE} verb={TRY_AGAIN} onVerb={() => void appQueryClient.refetchQueries()} ember />
    );
  if (update.ready)
    return (
      <Notice
        icon="Up"
        line={APP_STATE_WORDS.updateReady}
        verb={APP_STATE_WORDS.update}
        loading={updating || update.waiting ? APP_STATE_WORDS.updating : undefined}
        onVerb={() => {
          setUpdating(true);
          void update.update().finally(() => setUpdating(false));
        }}
        onLater={update.later}
      />
    );
  // Install is offered once the player has an account, never to a first visit.
  if (session && !install.installed && !installLater)
    return (
      <Notice
        icon="In"
        line={APP_STATE_WORDS.onHomeScreen}
        verb={APP_STATE_WORDS.install}
        onVerb={() => void install.install()}
        onLater={() => {
          putInstallOff();
          setInstallLater(true);
        }}
      />
    );
  return null;
};
