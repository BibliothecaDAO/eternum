import { readFinalLedgerHead, readFrontierFunding } from "@realms-world/value-ledger";
import type { ObligationState } from "./obligations";

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

/** The ledger a Frontier job reads, and what the relay already knows about it. */
export interface FrontierLedger {
  rpcUrl: string;
  address: string;
  finals: FinalFacts;
  /** Where obligations awaiting proof are kept, and whether this pass is one that attempts them. */
  obligations: ObligationState;
  proofs: boolean;
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

/**
 * Keeps `fact` if `holdsAt` says it held at the newest Ethereum-accepted block. Not yet final means nothing is stored
 * and the caller reads again next time; a fact that holds at the head but not there simply waits for acceptance.
 */
export async function keepIfFinal(
  finals: FinalFacts,
  fact: string,
  provider: Parameters<typeof readFinalLedgerHead>[0],
  holdsAt: (block: number) => Promise<boolean>,
) {
  try {
    const final = await readFinalLedgerHead(provider);
    if (await holdsAt(final.number)) await finals.mark(fact, { block: final.number, hash: final.hash });
  } catch (error) {
    // Nothing is kept, so the next tick reads again; the work that called this has already been done.
    console.error("final_evidence_unavailable", {
      fact,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** The season's funding as of `block`, or null if it was not funded yet there. */
export async function fundingAt(
  provider: Parameters<typeof readFrontierFunding>[0],
  address: string,
  key: { chainId: string; gameId: number },
  terms: Parameters<typeof readFrontierFunding>[3],
  block: number,
) {
  try {
    return await readFrontierFunding(provider, address, key, terms, block);
  } catch (error) {
    if (error instanceof Error && error.message === "frontier_funding_missing") return null;
    throw error;
  }
}

/** `closed` is set once by the ledger; it is kept only once the block that set it is final. */
export const closedSeason = (chainId: string, gameId: number) => `closed:${BigInt(chainId)}:${gameId}`;
/** A season is funded once; the shard's pool is kept as matching only once the funding block is final. */
export const verifiedPool = (chainId: string, gameId: number) => `pool:${BigInt(chainId)}:${gameId}`;

export const memoryFinalFacts = (): FinalFacts => {
  const known = new Map<string, FinalEvidence>();
  return {
    has: async (fact) => known.has(fact),
    mark: async (fact, evidence) => void known.set(fact, evidence),
  };
};
