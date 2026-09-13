import { reconcilePushAccount } from "./push-notification-client";
import { useEffect, useState } from "react";
import { useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { notificationWorkerRequest, reportNotificationDeliveryError } from "./local-notification-client";

/** Keeps account preferences available outside Settings and revokes local device delivery on logout/account switch. */
export function LocalNotificationLifecycle() {
  const { session, status } = useIdentitySession();
  const [detachOwner, setDetachOwner] = useState<string | null>(null);
  const detach = async (owner: string) => {
    try {
      if (
        (await navigator.serviceWorker.getRegistration("/"))?.active &&
        useIdentitySessionStore.getState().session?.user.id !== owner
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
        const oldOwner = previous.session?.user.id;
        if (!oldOwner || oldOwner === next.session?.user.id || !("serviceWorker" in navigator)) return;
        void detach(oldOwner);
      }),
    [],
  );
  useEffect(() => {
    if (status === "loading") return;
    void reconcilePushAccount().catch((error) => {
      setDetachOwner(session?.user.id ?? "0x0");
      reportNotificationDeliveryError(error);
    });
  }, [status, session?.user.id]);
  return (
    <>
      {status !== "loading" && (
        <LoadPreferences key={session?.user.id ?? "anonymous"} owner={session?.user.id ?? null} />
      )}
      {detachOwner && (
        <aside
          role="alert"
          className="fixed bottom-4 left-4 z-[200] max-w-sm rounded border border-gold/40 bg-black p-3 text-sm text-gold"
        >
          Device notifications could not be disabled for your previous account.
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
