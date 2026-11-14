import type { FinalEvidence, FinalFacts } from "./final-facts";

/**
 * Everything the relay owes the chain or a player (a deposit to deliver or refund, a principal to return, a withdrawal
 * to pay) is one shape: an obligation, an attempt, and evidence. An obligation is durable from the moment it is known
 * until the accepted chain proves its outcome. It is never removed because a call returned, a receipt was accepted on
 * L2, or a pass ended; the only removal is `settle`, which takes the evidence. A rewritten block therefore puts the work
 * back by itself: the obligation was never removed, and its attempt is idempotent.
 *
 * An obligation is in one of three states: to do (attempted every pass), awaiting proof (attempted again only in a
 * proof pass: the hour, or an operator's request), or settled (final evidence stored). The attempt reads the head, does
 * the work if the head does not show it done, and returns the evidence if the accepted block shows it done too.
 */
export interface ObligationKind<O> {
  name: string;
  key(obligation: O): string;
  /** Idempotent: does the work if the head does not show it done; evidence only if the accepted block shows it. */
  attempt(obligation: O): Promise<{ final: FinalEvidence | null }>;
}
export interface ObligationState {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
export interface ObligationContext {
  finals: FinalFacts;
  state: ObligationState;
  /** A proof pass attempts obligations that are awaiting proof; a plain pass leaves them. */
  proofs: boolean;
}

const fact = (kind: { name: string }, key: string) => `${kind.name}:${key}`;
const awaitingKey = (kind: { name: string }, key: string) => `obligation:${fact(kind, key)}`;

/** The one place an obligation leaves the work: the evidence is the argument. */
async function settle(kind: { name: string }, context: ObligationContext, key: string, evidence: FinalEvidence) {
  await context.finals.mark(fact(kind, key), evidence);
  await context.state.delete(awaitingKey(kind, key));
}

/** Runs a pass over `work`; one obligation's failure never stops another. */
export async function driveObligations<O>(kind: ObligationKind<O>, work: readonly O[], context: ObligationContext) {
  const errors: { obligation: string; error: string }[] = [];
  const settled: string[] = [];
  let todo = 0;
  let awaiting = 0;
  let attempted = 0;
  for (const obligation of work) {
    const key = kind.key(obligation);
    if (await context.finals.has(fact(kind, key))) {
      settled.push(key);
      continue;
    }
    const waiting = (await context.state.get<true>(awaitingKey(kind, key))) === true;
    if (waiting && !context.proofs) {
      awaiting++;
      continue;
    }
    try {
      const { final } = await kind.attempt(obligation);
      attempted++;
      if (final) {
        await settle(kind, context, key, final);
        settled.push(key);
      } else {
        await context.state.put(awaitingKey(kind, key), true);
        awaiting++;
      }
    } catch (cause) {
      // An attempt that failed is work to do again on the next pass, whatever state it was in before.
      await context.state.delete(awaitingKey(kind, key));
      todo++;
      errors.push({ obligation: `${kind.name}:${key}`, error: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  return { errors, settled, todo, awaiting, attempted };
}

export const memoryObligations = (): ObligationState => {
  const kept = new Map<string, unknown>();
  return {
    get: async <A>(key: string) => kept.get(key) as A | undefined,
    put: async (key, value) => void kept.set(key, value),
    delete: async (key) => kept.delete(key),
  };
};
