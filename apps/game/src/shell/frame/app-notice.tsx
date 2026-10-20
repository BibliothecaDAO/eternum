import { useState, useSyncExternalStore } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useInstall } from "@/pwa/install-state";
import { usePwaUpdate } from "@/pwa/pwa-update-prompt";
import { appQueryClient } from "@/runtime/query-client";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { OFFLINE, TRY_AGAIN, APP_STATE_WORDS, LATER } from "@/ui/design-system/kit/words";

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
 * update ready, or Install (Later puts it off a week), which only Play offers: every other page keeps its room. PageFrame
 * places it above the foot row on a phone and in the top bar on desktop; a game never shows it, so an update waits
 * until Exit.
 */
export const useAppNotice = ({ offersInstall }: { offersInstall: boolean }) => {
  const online = useOnline();
  const { session } = useIdentitySession();
  const update = usePwaUpdate();
  const install = useInstall();
  const [installLater, setInstallLater] = useState(installPutOff);
  const [updating, setUpdating] = useState(false);

  if (!online)
    return (
      <AppNotice
        tone="bad"
        icon="network-off"
        line={OFFLINE}
        actions={
          <AppButton kind="secondary" onClick={() => void appQueryClient.refetchQueries()}>
            {TRY_AGAIN}
          </AppButton>
        }
      />
    );
  if (update.ready)
    return (
      <AppNotice
        icon="refresh"
        line={APP_STATE_WORDS.updateReady}
        actions={
          <>
            <AppButton kind="quiet" onClick={update.later}>
              {LATER}
            </AppButton>
            <AppButton
              kind="secondary"
              busy={updating || update.waiting ? APP_STATE_WORDS.updating : undefined}
              onClick={() => {
                setUpdating(true);
                void update.update().finally(() => setUpdating(false));
              }}
            >
              {APP_STATE_WORDS.update}
            </AppButton>
          </>
        }
      />
    );
  // Install is offered once the player has an account, never to a first visit.
  if (offersInstall && session && !install.installed && !installLater)
    return (
      <AppNotice
        icon="download"
        line={APP_STATE_WORDS.onHomeScreen}
        actions={
          <>
            <AppButton
              kind="quiet"
              onClick={() => {
                putInstallOff();
                setInstallLater(true);
              }}
            >
              {LATER}
            </AppButton>
            <AppButton kind="secondary" onClick={() => void install.install()}>
              {APP_STATE_WORDS.install}
            </AppButton>
          </>
        }
      />
    );
  return null;
};
