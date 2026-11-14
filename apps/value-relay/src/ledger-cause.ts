import { LEDGER_RETRY_SECONDS } from "@realms-world/chain";

interface CauseStorage {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
const now = () => Math.floor(Date.now() / 1000);

/** A stored cause: the earliest second it may be acted on, and a number that changes with every report. */
interface Cause {
  at: number;
  n: number;
}
/** A cause being worked on: what was stored when the work began. */
export interface Began {
  key: string;
  n: number;
}

/**
 * Causes follow the same rule as every other piece of work the relay owes: durable from the moment it is known until
 * the work it asked for is done and published. Beginning does not remove it; only `completeCause` does, and only if no
 * newer report arrived meanwhile. A worker killed anywhere in between leaves the cause in storage, due.
 */

/** A report. An earlier due time is kept; the report number always changes. */
export async function raiseCause(storage: CauseStorage, key: string, after = 0) {
  const stored = await storage.get<Cause>(key);
  const at = now() + after;
  await storage.put(key, { at: stored ? Math.min(stored.at, at) : at, n: (stored?.n ?? 0) + 1 });
}

/** Whether a cause is waiting and its time has come. */
export async function causeDue(storage: CauseStorage, key: string) {
  const stored = await storage.get<Cause>(key);
  return stored !== undefined && stored.at <= now();
}

/** Starts the work a cause asks for, if it is due; on the hour the hour itself is stored as a cause first. */
export async function beginCause(storage: CauseStorage, key: string, hourly: boolean): Promise<Began | null> {
  if (hourly && !(await causeDue(storage, key))) await raiseCause(storage, key);
  const stored = await storage.get<Cause>(key);
  return stored && stored.at <= now() ? { key, n: stored.n } : null;
}

/** The work finished and was published: the cause goes, unless a report came in after it began. */
export async function completeCause(storage: CauseStorage, began: Began) {
  const stored = await storage.get<Cause>(began.key);
  if (stored?.n === began.n) await storage.delete(began.key);
}

/** The work did not finish: the same cause is due again after `after` seconds. A newer report keeps its own time. */
export async function retryCause(storage: CauseStorage, began: Began, after = LEDGER_RETRY_SECONDS) {
  const stored = await storage.get<Cause>(began.key);
  if (stored?.n === began.n) await storage.put(began.key, { at: now() + after, n: stored.n });
}
