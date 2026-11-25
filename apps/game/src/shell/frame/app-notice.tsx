import { useState, useSyncExternalStore } from "react";

import { usePwaUpdate } from "@/pwa/pwa-update-prompt";
import { appQueryClient } from "@/runtime/query-client";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { OFFLINE, TRY_AGAIN, APP_STATE_WORDS, LATER } from "@/ui/design-system/kit/words";

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

export const useAppNotice = () => {
  const online = useOnline();
  const update = usePwaUpdate();
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
  return null;
};
