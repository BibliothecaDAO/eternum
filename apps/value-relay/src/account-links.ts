import { Effect, Result } from "effect";
import type { AccountLinkTarget, LedgerAccountLinkWrite } from "@realms-world/identity";
import { RelayFailure, relayOperation } from "./ports";
interface LinkPorts {
  identity: {
    dirty(): Promise<{ target: AccountLinkTarget; revision: string }[]>;
    complete(account: string, revision: string): Promise<void>;
    targets(after: string | null): Promise<{ rows: AccountLinkTarget[]; next: string | null }>;
    refresh(target: AccountLinkTarget): Promise<AccountLinkTarget>;
    record(target: AccountLinkTarget, write: LedgerAccountLinkWrite): Promise<void>;
  };
  ledger: {
    paused(): Promise<boolean>;
    read(wallet: string | null, account: string | null): Promise<{ wallet: string; account: string }>;
    set(
      wallet: string,
      account: string,
      onSigning: (write: LedgerAccountLinkWrite) => Promise<void>,
    ): Promise<LedgerAccountLinkWrite>;
    confirm(transactionHash: string): Promise<boolean>;
  };
}
interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<unknown>;
}
const same = (a: string | null, b: string) => BigInt(a ?? 0) === BigInt(b);
export const hasMatchingAccountLink = (target: AccountLinkTarget, actual: { wallet: string; account: string }) =>
  target.wallet && target.account
    ? same(target.wallet, actual.wallet) && same(target.account, actual.account)
    : target.wallet
      ? same(null, actual.account)
      : same(null, actual.wallet);

/** The signed hash enters identity's history before broadcast; no successful submit response is needed for its audit. */
export const synchronizeAccountLink = (target: AccountLinkTarget, ports: LinkPorts) =>
  relayOperation("synchronize account link", async () => {
    const desired = await ports.identity.refresh(target);
    const actual = await ports.ledger.read(desired.wallet, desired.account);
    if (hasMatchingAccountLink(desired, actual)) return "confirmed" as const;
    if (await ports.ledger.paused()) return "linking" as const;
    const wallet = desired.wallet ?? actual.wallet;
    const account = desired.wallet ? (desired.account ?? "0x0") : "0x0";
    const write = await ports.ledger.set(wallet, account, (write) => ports.identity.record(desired, write));
    if (!(await ports.ledger.confirm(write.transactionHash))) return "linking" as const;
    const recorded = await ports.ledger.read(desired.wallet, desired.account);
    if (!hasMatchingAccountLink(desired, recorded)) throw new Error("account_link_not_confirmed");
    return "confirmed" as const;
  });

/** Current accounts and historical wallets share one bounded, restarting cursor. No notification is sole truth. */
export const reconcileAccountLinks = (ports: LinkPorts, store: Store) =>
  Effect.gen(function* () {
    const dirty = yield* relayOperation("read dirty identity links", () => ports.identity.dirty());
    if (dirty.length > 25) return yield* Effect.fail(new RelayFailure({ operation: "invalid_dirty_link_page" }));
    const dirtyPending: string[] = [];
    for (const row of dirty) {
      const result = yield* Effect.result(synchronizeAccountLink(row.target, ports));
      if (Result.isSuccess(result) && result.success === "confirmed")
        yield* relayOperation("acknowledge identity link", () =>
          ports.identity.complete(row.target.realmsId, row.revision),
        );
      else dirtyPending.push(row.target.key);
    }
    const cursor = (yield* relayOperation("read link cursor", () => store.get<string | null>("link-cursor"))) ?? null;
    const page = yield* relayOperation("read identity link page", () => ports.identity.targets(cursor));
    if (page.rows.length > 25 || (page.next !== null && page.next === cursor))
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_identity_link_page" }));
    const failed: string[] = [];
    for (const target of page.rows) {
      const result = yield* Effect.result(synchronizeAccountLink(target, ports));
      if (Result.isFailure(result) || result.success === "linking") failed.push(target.key);
    }
    yield* relayOperation("advance identity link cursor", () => store.put("link-cursor", page.next));
    return { checked: page.rows.length + dirty.length, pending: [...dirtyPending, ...failed] };
  });
