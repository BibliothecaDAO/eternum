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
      ownerTotalResourceFees: new Map<number, number>(),
      poolTotalLordsFees: 0,
      poolTotalResourceFees: new Map<number, number>(),
      dailyClosingPriceResults: new Map<number, any>(),
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
