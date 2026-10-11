import { useEffect } from "react";
import { create } from "zustand";

import { selectHasPendingTransactions, useTransactionStore } from "@/hooks/store/use-transaction-store";

import { registerGameServiceWorker } from "./register-service-worker";

/** A new version waiting to take over; the app's update notice reads it. */
const usePwaUpdateState = create<{ apply: (() => Promise<void>) | null }>(() => ({ apply: null }));

/** Registers the service worker at the app root, so an update is known on any route. */
export function PwaUpdateRuntime() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    return registerGameServiceWorker(import.meta.env.VITE_PUBLIC_GAME_VERSION || "development", (apply) =>
      usePwaUpdateState.setState({ apply }),
    );
  }, []);
  return null;
}

/**
 * The update waiting, if any: applying it never interrupts an action in flight (it waits for pending transactions),
 * and Later puts it off until the next one.
 */
export const usePwaUpdate = () => {
  const ready = usePwaUpdateState((state) => state.apply !== null);
  const pending = useTransactionStore(selectHasPendingTransactions);
  const update = async () => {
    const { apply } = usePwaUpdateState.getState();
    if (!apply || selectHasPendingTransactions(useTransactionStore.getState())) return;
    await apply();
    if (!selectHasPendingTransactions(useTransactionStore.getState())) window.location.reload();
  };
  return { ready, waiting: pending, update, later: () => usePwaUpdateState.setState({ apply: null }) };
};
