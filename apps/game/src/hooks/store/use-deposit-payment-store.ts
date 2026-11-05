import type { Call } from "starknet";
import { create } from "zustand";

/**
 * A LORDS deposit the purse asks the payout wallet to pay: its calls, the amount and request identity they carry, and
 * what the purse does once they land. The purse is a HUD sheet and draws no wallet; the world layout opens the payment
 * on the app sheet, where every wallet send is drawn (shell/value/deposit-payment.tsx).
 */
interface DepositPayment {
  owner: string;
  calls: Call[];
  amount: string;
  request: string;
  onLanded: () => void;
}

interface DepositPaymentState {
  payment: DepositPayment | null;
  open: (payment: DepositPayment) => void;
  /** Closes the payment of that request only: a late answer to an earlier one never closes a newer payment. */
  close: (request: string) => void;
}

export const useDepositPaymentStore = create<DepositPaymentState>((set) => ({
  payment: null,
  open: (payment) => set({ payment }),
  close: (request) => set((state) => (state.payment?.request === request ? { payment: null } : state)),
}));
