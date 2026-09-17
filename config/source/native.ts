import type { BlitzBalanceProfileId } from "./blitz";

export const nativeBalance = {
  bitcoin: { prizePerPhase: 1, minimumLabor: 100, ownerCutBps: 2000 },
  mineWeights: {
    eternum: [
      { kind: 1, weight: 1 },
      { kind: 2, weight: 1 },
    ],
    blitz: [{ kind: 1, weight: 1 }],
  },
};

export const nativePresets: Record<number, { gameType: "eternum" | "blitz"; profile?: BlitzBalanceProfileId }> = {
  1: { gameType: "eternum" },
  2: { gameType: "blitz", profile: "official-60" },
  3: { gameType: "blitz", profile: "official-90" },
};
