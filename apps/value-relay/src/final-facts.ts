/** The block a fact was read at, once Ethereum had accepted it: the evidence that no rewrite can reach it. */
export interface FinalEvidence {
  block: number;
  hash: string;
}

/**
 * A fact the relay keeps instead of asking the chain again. It is stored only with its evidence: it held at the
 * newest Ethereum-accepted block. A fact seen only at the head, or only in the receipt of a transaction, is not kept,
 * because a rewrite of that block could take it back; it is read again until it is final.
 */
export interface FinalFacts {
  has(fact: string): Promise<boolean>;
  mark(fact: string, evidence: FinalEvidence): Promise<void>;
}

export const durableFinalFacts = (storage: {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
}): FinalFacts => ({
  has: async (fact) => (await storage.get<FinalEvidence>(`final:${fact}`)) !== undefined,
  mark: async (fact, evidence) => {
    await storage.put(`final:${fact}`, evidence);
  },
});

export const closedRace = (chainId: string, gameId: number) => `race-closed:${BigInt(chainId)}:${gameId}`;

export const memoryFinalFacts = (): FinalFacts => {
  const known = new Map<string, FinalEvidence>();
  return {
    has: async (fact) => known.has(fact),
    mark: async (fact, evidence) => void known.set(fact, evidence),
  };
};
