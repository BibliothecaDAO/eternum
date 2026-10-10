import { Effect, Result } from "effect";
import type { AccountLinkTarget, LedgerAccountLinkWrite } from "@realms-world/identity";
import { RelayFailure, relayOperation } from "./ports";
interface LinkPorts {
  identity: {
    target(key: string): Promise<AccountLinkTarget>;
    dirty(
      after: number | null,
    ): Promise<{ rows: { target: AccountLinkTarget; revision: string }[]; next: number | null }>;
    complete(account: string, revision: string): Promise<void>;
    targets(after: string | null): Promise<{ rows: AccountLinkTarget[]; next: string | null }>;
    refresh(target: AccountLinkTarget): Promise<AccountLinkTarget>;
    record(target: AccountLinkTarget, write: LedgerAccountLinkWrite): Promise<void>;
  };
  ledger: {
    readPending(wallet: string | null, account: string | null): Promise<{ wallet: string; account: string }>;
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
    const actual = await ports.ledger.readPending(desired.wallet, desired.account);
    if (hasMatchingAccountLink(desired, actual)) {
      const confirmed = await ports.ledger.read(desired.wallet, desired.account);
      return hasMatchingAccountLink(desired, confirmed) ? ("confirmed" as const) : ("linking" as const);
    }
    if (desired.wallet && (await ports.ledger.paused())) {
      // Removing an obsolete mapping remains legal; installs wait for unpause.
      if (BigInt(actual.account) !== 0n && !same(desired.account, actual.account)) {
        const write = await ports.ledger.set(desired.wallet, "0x0", (write) => ports.identity.record(desired, write));
        await ports.ledger.confirm(write.transactionHash);
      }
      if (BigInt(actual.wallet) !== 0n && !same(desired.wallet, actual.wallet)) {
        const former = await ports.identity.target(`wallet:${actual.wallet}`);
        await Effect.runPromise(synchronizeAccountLink(former, ports));
      }
      return "linking" as const;
    }
    const wallet = desired.wallet ?? actual.wallet;
    const account = desired.wallet ? (desired.account ?? "0x0") : "0x0";
    const write = await ports.ledger.set(wallet, account, (write) => ports.identity.record(desired, write));
    if (!(await ports.ledger.confirm(write.transactionHash))) return "linking" as const;
    const recorded = await ports.ledger.read(desired.wallet, desired.account);
    if (!hasMatchingAccountLink(desired, recorded)) throw new Error("account_link_not_confirmed");
    return "confirmed" as const;
  });

/** Current accounts and historical wallets share one bounded, restarting cursor. No notification is sole truth. */
export const reconcileAccountLinks = (
  ports: LinkPorts,
  store: Store,
  sync = (target: AccountLinkTarget) => synchronizeAccountLink(target, ports),
) =>
  Effect.gen(function* () {
    const dirtyCursor =
      (yield* relayOperation("read dirty link cursor", () => store.get<number | null>("dirty-link-cursor"))) ?? null;
    const dirtyPage = yield* relayOperation("read dirty identity links", () => ports.identity.dirty(dirtyCursor));
    const dirty = dirtyPage.rows;
    if (
      dirty.length > 25 ||
      (dirtyPage.next !== null && dirtyPage.next === dirtyCursor && dirty.some((row) => row.target.wallet !== null))
    )
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_dirty_link_page" }));
    const dirtyPending: string[] = [];
    for (const row of dirty) {
      const result = yield* Effect.result(sync(row.target));
      if (Result.isSuccess(result) && result.success === "confirmed")
        yield* relayOperation("acknowledge identity link", () =>
          ports.identity.complete(row.target.realmsId, row.revision),
        );
      else dirtyPending.push(row.target.key);
    }
    yield* relayOperation("advance dirty link cursor", () => store.put("dirty-link-cursor", dirtyPage.next));
    const cursor = (yield* relayOperation("read link cursor", () => store.get<string | null>("link-cursor"))) ?? null;
    const page = yield* relayOperation("read identity link page", () => ports.identity.targets(cursor));
    if (page.rows.length > 25 || (page.next !== null && page.next === cursor))
      return yield* Effect.fail(new RelayFailure({ operation: "invalid_identity_link_page" }));
    const failed: string[] = [];
    for (const target of page.rows) {
      const result = yield* Effect.result(sync(target));
      if (Result.isFailure(result) || result.success === "linking") failed.push(target.key);
    }
    yield* relayOperation("advance identity link cursor", () => store.put("link-cursor", page.next));
    return { checked: page.rows.length + dirty.length, pending: [...dirtyPending, ...failed] };
  });
