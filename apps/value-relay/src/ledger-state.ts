/**
 * Ledger history (audit cursors, chest queue, season events) belongs to one ledger. Each worker keeps it in a Durable
 * Object named for that ledger, and the object records its ledger on first use and refuses any other, so a new ledger
 * never continues another ledger's cursors or derived state.
 */
import { ValuePlaneAddressMissingError } from "@realms-world/chain";

const BOUND = "ledgerState:ledger";

const normalized = (ledger: string) => `0x${BigInt(ledger).toString(16)}`;

/** The environment's ledger, or null before setup publishes one: its workers then hold no ledger history. */
export const ledgerOrNull = (address: () => string) => {
  try {
    return address();
  } catch (error) {
    if (error instanceof ValuePlaneAddressMissingError) return null;
    throw error;
  }
};

/** The Durable Object name for a role's state on one ledger, or before any ledger is deployed. */
export const ledgerStateName = (role: "ledger" | "monitor", ledger: string | null) =>
  `${role}:${ledger === null ? "undeployed" : normalized(ledger)}`;

export const bindLedgerState = async (storage: Pick<DurableObjectStorage, "get" | "put">, ledger: string | null) => {
  if (ledger === null) return;
  const own = normalized(ledger);
  const bound = await storage.get<string>(BOUND);
  if (bound === undefined) await storage.put(BOUND, own);
  else if (bound !== own) throw new Error("ledger_state_belongs_to_another_ledger");
};
