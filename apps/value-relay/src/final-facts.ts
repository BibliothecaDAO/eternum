/** A fact the ledger can never change again. The relay asks the chain once, keeps the answer, and never asks again. */
export interface FinalFacts {
  has(fact: string): Promise<boolean>;
  mark(fact: string): Promise<void>;
}

/** The ledger a Frontier job reads, and what the relay already knows about it. */
export interface FrontierLedger {
  rpcUrl: string;
  address: string;
  finals: FinalFacts;
}

export const durableFinalFacts = (storage: {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
}): FinalFacts => ({
  has: async (fact) => (await storage.get<true>(`final:${fact}`)) === true,
  mark: async (fact) => {
    await storage.put(`final:${fact}`, true);
  },
});

/** `closed` is set once by the ledger and never cleared. */
export const closedSeason = (chainId: string, gameId: number) => `closed:${BigInt(chainId)}:${gameId}`;
/** A paid principal stays paid. */
export const paidPrincipal = (chainId: string, gameId: number, account: string) =>
  `principal:${BigInt(chainId)}:${gameId}:${BigInt(account)}`;
/** A season is funded once, and the relay compared the shard's published pool with it. */
export const verifiedPool = (chainId: string, gameId: number) => `pool:${BigInt(chainId)}:${gameId}`;

export const memoryFinalFacts = (): FinalFacts => {
  const known = new Set<string>();
  return {
    has: async (fact) => known.has(fact),
    mark: async (fact) => void known.add(fact),
  };
};
