import { useEffect, useState } from "react";
import { selectHasPendingTransactions, useTransactionStore } from "@/hooks/store/use-transaction-store";
import { registerGameServiceWorker } from "./register-service-worker";

/** App-level update control survives route changes and never interrupts an in-flight action. */
export function PwaUpdatePrompt() {
  const [applyUpdate, setApplyUpdate] = useState<(() => Promise<void>) | null>(null);
  const [applying, setApplying] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useTransactionStore(selectHasPendingTransactions);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    return registerGameServiceWorker((apply) => setApplyUpdate(() => apply));
  }, []);

  if (!applyUpdate) return null;
  const apply = async () => {
    if (selectHasPendingTransactions(useTransactionStore.getState())) return;
    setApplying(true);
    setFailed(false);
    try {
      await applyUpdate();
      if (!selectHasPendingTransactions(useTransactionStore.getState())) window.location.reload();
      else setApplying(false);
    } catch {
      setApplying(false);
      setFailed(true);
    }
  };

  return (
    <aside
      aria-label="Game update"
      className="fixed inset-x-4 top-4 z-[200] mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl border border-gold/30 bg-black/95 p-4 text-sm text-gold shadow-xl"
    >
      <p role="status">
        {pending
          ? "Update ready. Waiting for your transaction to finish."
          : failed
            ? "Update could not be applied. Please try again."
            : "A game update is ready."}
      </p>
      <button
        type="button"
        className="shrink-0 rounded border border-gold/50 px-3 py-2 disabled:opacity-50"
        disabled={pending || applying}
        onClick={() => void apply()}
      >
        {applying ? "Updating…" : "Update now"}
      </button>
      <button
        type="button"
        className="shrink-0 px-1 py-2 text-gold/70 disabled:opacity-50"
        disabled={applying}
        onClick={() => setApplyUpdate(null)}
      >
        Later
      </button>
    </aside>
  );
}
