import { useUIStore } from "@/hooks/store/use-ui-store";
import { transactions } from "@/ui/features/world";
import { CenteredModalShell } from "@/ui/features/world/containers/centered-modal-shell";
import { TransactionList } from "./transaction-list";

export const TransactionWindow = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(transactions));

  if (!isOpen) return null;

  return (
    <CenteredModalShell
      title="Transactions"
      onClose={() => togglePopup(transactions)}
      persistKey="Transactions"
      panelClassName="w-[360px] h-auto max-h-[calc(100vh-64px)]"
      bodyClassName="overflow-auto"
    >
      <div className="flex flex-col">
        <TransactionList maxRecentTransactions={15} />
        <div className="px-3 py-2 border-t border-gold/10 bg-dark-brown/30">
          <p className="text-[10px] text-gold/30 text-center">Click a transaction to view on Voyager</p>
        </div>
      </div>
    </CenteredModalShell>
  );
};
