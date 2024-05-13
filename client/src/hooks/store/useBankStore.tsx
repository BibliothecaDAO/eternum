import { BankStatsInterface, computeBankStats } from "@/dojo/events/bankEventQueries";
import { create } from "zustand";

interface BankStore {
  bankStats: BankStatsInterface;
  setBankStats: (bankStats: BankStatsInterface) => void;
}

const useBankStore = create<BankStore>((set) => {
  return {
    bankStats: {
      ownerTotalLordsFees: 0,
      ownerTotalResourceFees: new Map<string, number>(),
      poolTotalLordsFees: 0,
      poolTotalResourceFees: new Map<string, number>(),
      dailyClosingPriceResults: new Map<string, any>(),
    },
    setBankStats: (bankStats: BankStatsInterface) => {
      set({ bankStats });
    },
  };
});

export const useComputeBankStats = () => {
  const setBankStats = useBankStore((state) => state.setBankStats);
  computeBankStats().then((data) => {
    setBankStats(data);
  });
};

export default useBankStore;
