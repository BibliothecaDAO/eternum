import { useAccountStore } from "@/hooks/store/use-account-store";
import * as Sentry from "@sentry/react";
import { useEffect } from "react";

import { env } from "../../env";
import { resolveUserIdentity } from "./wallet-identity";

const isSentryEnabled = (): boolean => Boolean(env.VITE_PUBLIC_SENTRY_DSN) && import.meta.env.PROD;

export const SentryUserSync = (): null => {
  const address = useAccountStore((s) => s.account?.address ?? null);

  useEffect(() => {
    if (!isSentryEnabled()) return;

    if (!address) {
      Sentry.setUser(null);
      return;
    }

    let cancelled = false;
    void resolveUserIdentity(address).then((identity) => {
      if (cancelled) return;
      if (identity) Sentry.setUser({ id: identity });
    });

    return () => {
      cancelled = true;
    };
  }, [address]);

  return null;
};
