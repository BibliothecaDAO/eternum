import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { reconcileAccountLinks, synchronizeAccountLink } from "./account-links";
import type { AccountLinkTarget } from "@realms-world/identity";
const target: AccountLinkTarget = {
  key: "account:0x1",
  realmsId: "0x1",
  wallet: "0x10",
  account: "0x20",
  historyId: 1,
};
const forward = new Map<string, string>(),
  reverse = new Map<string, string>(),
  state = new Map<string, unknown>();
const set = vi.fn(
  async (
    wallet: string,
    account: string,
    onSigning: (write: import("@realms-world/identity").LedgerAccountLinkWrite) => Promise<void>,
  ) => {
    const previousAccount = forward.get(wallet) ?? "0x0",
      previousWallet = account === "0x0" ? "0x0" : (reverse.get(account) ?? "0x0");
    await onSigning({ transactionHash: "0xabc", wallet, account, previousAccount, previousWallet });
    if (previousAccount !== "0x0") reverse.delete(previousAccount);
    if (previousWallet !== "0x0") forward.delete(previousWallet);
    if (account === "0x0") forward.delete(wallet);
    else {
      forward.set(wallet, account);
      reverse.set(account, wallet);
    }
    return { transactionHash: "0xabc", wallet, account, previousAccount, previousWallet };
  },
);
const identity = {
  targets: vi.fn(
    async (_after: string | null): Promise<{ rows: AccountLinkTarget[]; next: string | null }> => ({
      rows: [target],
      next: null,
    }),
  ),
  refresh: vi.fn(async (row: AccountLinkTarget) => row),
  record: vi.fn(async () => {}),
};
const ledger = {
  paused: vi.fn(async () => false),
  read: vi.fn(async (wallet: string | null, account: string | null) => ({
    account: wallet ? (forward.get(wallet) ?? "0x0") : "0x0",
    wallet: account ? (reverse.get(account) ?? "0x0") : "0x0",
  })),
  set,
  confirm: vi.fn(async () => true),
};
const store = {
  get: async <T>(key: string) => state.get(key) as T | undefined,
  put: async <T>(key: string, value: T) => {
    state.set(key, value);
  },
  delete: async (key: string) => state.delete(key),
  list: async <T>(options: { prefix: string; limit: number }) =>
    new Map(
      [...state.entries()].filter(([key]) => key.startsWith(options.prefix)).slice(0, options.limit) as [string, T][],
    ),
};
beforeEach(() => {
  vi.clearAllMocks();
  forward.clear();
  reverse.clear();
  state.clear();
  identity.refresh.mockImplementation(async (row) => row);
  identity.targets.mockResolvedValue({ rows: [target], next: null });
  identity.record.mockResolvedValue(undefined);
  ledger.paused.mockResolvedValue(false);
  ledger.confirm.mockResolvedValue(true);
});
it("links immediately, verifies both maps and is idempotent without consulting the payout hold", async () => {
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
  expect(set).toHaveBeenCalledWith("0x10", "0x20", expect.any(Function));
  expect(identity.record).toHaveBeenCalledWith(target, expect.objectContaining({ transactionHash: "0xabc" }));
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
  expect(set).toHaveBeenCalledOnce();
});
it("replaces atomically and clears the reverse mapping on unlink", async () => {
  forward.set("0x99", "0x20");
  reverse.set("0x20", "0x99");
  await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }));
  expect(forward.has("0x99")).toBe(false);
  await Effect.runPromise(synchronizeAccountLink({ ...target, wallet: null, historyId: 2 }, { identity, ledger }));
  expect(forward.size).toBe(0);
  expect(reverse.size).toBe(0);
});
it("recovers historical wallets and ignores stale page contents in favor of current identity", async () => {
  forward.set("0x99", "0x30");
  reverse.set("0x30", "0x99");
  identity.targets.mockResolvedValue({
    rows: [{ ...target, key: "wallet:0x99", wallet: "0x99", account: null }],
    next: null,
  });
  await Effect.runPromise(reconcileAccountLinks({ identity, ledger }, store));
  expect(forward.size).toBe(0);
  identity.refresh.mockResolvedValue({ ...target, wallet: "0x11", historyId: 3 });
  await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }));
  expect(set).toHaveBeenLastCalledWith("0x11", "0x20", expect.any(Function));
});
it("waits while paused and resumes on unpause", async () => {
  ledger.paused.mockResolvedValue(true);
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("linking");
  expect(set).not.toHaveBeenCalled();
  ledger.paused.mockResolvedValue(false);
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
});
it("bounds each tick to one page and resumes its cursor after recreation", async () => {
  identity.targets
    .mockResolvedValueOnce({ rows: [target], next: "account:0x1" })
    .mockResolvedValueOnce({ rows: [], next: null });
  await Effect.runPromise(reconcileAccountLinks({ identity, ledger }, store));
  await Effect.runPromise(reconcileAccountLinks({ identity, ledger }, store));
  expect(identity.targets.mock.calls.map((call) => call[0])).toEqual([null, "account:0x1"]);
});
it("cannot broadcast without first saving its identity history receipt", async () => {
  identity.record.mockRejectedValueOnce(new Error("identity down"));
  await expect(Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).rejects.toThrow();
  expect(forward.size).toBe(0);
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
  expect(identity.record).toHaveBeenCalledTimes(2);
});

it("can retry a confirmed revert after a pause raced the broadcast", async () => {
  set.mockResolvedValueOnce({
    transactionHash: "0xabc",
    wallet: "0x10",
    account: "0x20",
    previousAccount: "0x0",
    previousWallet: "0x0",
  });
  ledger.confirm.mockResolvedValueOnce(false);
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("linking");
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
  expect(set).toHaveBeenCalledTimes(2);
});

it("keeps an authorized link auditable if the submit response is lost after broadcast", async () => {
  const actual = set.getMockImplementation()!;
  set.mockImplementationOnce(async (wallet, account, onSigning) => {
    await actual(wallet, account, onSigning);
    throw new Error("response lost");
  });
  await expect(Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).rejects.toThrow();
  expect(identity.record).toHaveBeenCalledOnce();
  expect(await Effect.runPromise(synchronizeAccountLink(target, { identity, ledger }))).toBe("confirmed");
  expect(set).toHaveBeenCalledOnce();
});
