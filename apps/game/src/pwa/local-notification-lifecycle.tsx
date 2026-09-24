import { reconcilePushAccount } from "./push-notification-client";
import { useEffect, useState } from "react";
import { notificationOwnerOf, useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { notificationWorkerRequest, reportNotificationDeliveryError } from "./local-notification-client";
import { startPushForegroundLifecycle } from "./push-foreground-lifecycle";

/** Keeps account preferences available outside Settings and revokes local device delivery on logout/account switch. */
export function LocalNotificationLifecycle() {
  const { session, status } = useIdentitySession();
  const owner = notificationOwnerOf(session);
  const [detachOwner, setDetachOwner] = useState<string | null>(null);
  const detach = async (owner: string) => {
    try {
      if (
        (await navigator.serviceWorker.getRegistration("/"))?.active &&
        notificationOwnerOf(useIdentitySessionStore.getState().session) !== owner
      )
        await notificationWorkerRequest(owner, "disable");
      await reconcilePushAccount();
      setDetachOwner((pending) => (pending === owner ? null : pending));
    } catch (error) {
      setDetachOwner(owner);
      reportNotificationDeliveryError(error);
    }
  };
  useEffect(
    () =>
      useIdentitySessionStore.subscribe((next, previous) => {
        const oldOwner = notificationOwnerOf(previous.session);
        if (!oldOwner || oldOwner === notificationOwnerOf(next.session) || !("serviceWorker" in navigator)) return;
        void detach(oldOwner);
      }),
    [],
  );
  useEffect(() => {
    if (status === "loading") return;
    void reconcilePushAccount().catch((error) => {
      setDetachOwner(owner ?? "0x0");
      reportNotificationDeliveryError(error);
    });
  }, [status, owner]);
  useEffect(() => {
    if (!owner) return;
    return startPushForegroundLifecycle(owner);
  }, [owner]);
  return (
    <>
      {status !== "loading" && <LoadPreferences key={owner ?? "anonymous"} owner={owner} />}
      {detachOwner && (
        <aside
          role="alert"
          className="fixed bottom-4 left-4 z-[200] max-w-sm rounded border border-gold/40 bg-black p-3 text-sm text-gold"
        >
          Background notifications need attention. Reconnect or apply the latest game update, then retry.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => {
              void reconcilePushAccount()
                .then(() => detach(detachOwner))
                .catch(reportNotificationDeliveryError);
            }}
          >
            Retry
          </button>
        </aside>
      )}
    </>
  );
}

function LoadPreferences({ owner }: { owner: string | null }) {
  useNotificationPreferences(owner);
  return null;
}
