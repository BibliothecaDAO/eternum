import { LEDGER_RETRY_SECONDS } from "@realms-world/chain";

interface CauseStorage {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}
const now = () => Math.floor(Date.now() / 1000);

/** A cause to read the ledger, stored as the earliest second it may be acted on; an earlier cause is never pushed later. */
export async function raiseCause(storage: CauseStorage, key: string, after = 0) {
  const at = now() + after;
  const earlier = await storage.get<number>(key);
  if (earlier === undefined || at < earlier) await storage.put(key, at);
}

/** Whether a cause is waiting and its time has come, without consuming it. */
export async function causeDue(storage: CauseStorage, key: string) {
  const at = await storage.get<number>(key);
  return at !== undefined && at <= now();
}

/** Consumes the cause when the hour or the cause says it is time. The work must then call `retryCause` unless it finished. */
export async function takeCause(storage: CauseStorage, key: string, hourly: boolean) {
  const at = await storage.get<number>(key);
  if (!hourly && (at === undefined || at > now())) return false;
  await storage.delete(key);
  return true;
}

/** The work the cause asked for did not finish: it is asked again in five minutes, whatever the hour. */
export const retryCause = (storage: CauseStorage, key: string) => raiseCause(storage, key, LEDGER_RETRY_SECONDS);
