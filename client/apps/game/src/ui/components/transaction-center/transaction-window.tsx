import { useUIStore } from "@/hooks/store/use-ui-store";
import { OSWindow, transactions } from "@/ui/features/world";
import { TransactionList } from "./transaction-list";

export const TransactionWindow = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(transactions));

  return (
    <OSWindow
      onClick={() => togglePopup(transactions)}
      show={isOpen}
      title="Transactions"
      width="360px"
      height="auto"
    >
      <div className="flex flex-col">
        <TransactionList maxRecentTransactions={15} />
        <div className="px-3 py-2 border-t border-gold/10 bg-dark-brown/30">
          <p className="text-[10px] text-gold/30 text-center">Click a transaction to view on Voyager</p>
        </div>
      </div>
    </OSWindow>
  );
};
