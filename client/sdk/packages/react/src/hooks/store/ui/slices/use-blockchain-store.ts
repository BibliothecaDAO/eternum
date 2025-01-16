export interface BlockchainStore {
  nextBlockTimestamp: number | undefined;
  setNextBlockTimestamp: (nextBlockTimestamp: number) => void;
  currentArmiesTick: number;
  setCurrentArmiesTick: (currentDefaultTick: number) => void;
  currentDefaultTick: number;
  setCurrentDefaultTick: (currentDefaultTick: number) => void;
}

export const createBlockchainStore = (set: any) => ({
  nextBlockTimestamp: undefined,
  setNextBlockTimestamp: (nextBlockTimestamp: number) => set({ nextBlockTimestamp }),
  currentDefaultTick: 0,
  setCurrentDefaultTick: (currentDefaultTick: number) => set({ currentDefaultTick }),
  currentArmiesTick: 0,
  setCurrentArmiesTick: (currentArmiesTick: number) => set({ currentArmiesTick }),
});
