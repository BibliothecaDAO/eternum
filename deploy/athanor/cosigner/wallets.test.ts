import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { openCosignerWallets, readWalletRecords, type WalletObservation } from "./wallets";

let directory: string, path: string, now: number;
let wallets: ReturnType<typeof openCosignerWallets>;
const warnings: WalletObservation[] = [];
const reopen = () => {
  wallets.close();
  wallets = openCosignerWallets(
    path,
    () => now,
    (entry) => warnings.push(entry),
  );
};
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "cosigner-wallets-"));
  path = join(directory, "wallets.sqlite");
  now = 1000;
  warnings.length = 0;
  wallets = openCosignerWallets(
    path,
    () => now,
    (entry) => warnings.push(entry),
  );
});
afterEach(() => {
  wallets.close();
  rmSync(directory, { recursive: true });
});

test("first and unchanged wallets remain instant and persist across a process restart", () => {
  wallets.assertWallet("0xa", "0x1", "0x100");
  expect(statSync(path).mode & 0o777).toBe(0o600);
  reopen();
  expect(() => wallets.assertWallet("10", "1", "256")).not.toThrow();
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  expect(warnings).toEqual([
    { event: "cosigner_wallet_change_waiting", account: "0xa", realmsId: "0x1", wallet: "0x200", notBefore: 87400 },
  ]);
});
test("a changed wallet waits 24 hours including after a restart, then becomes the known wallet", () => {
  wallets.assertWallet("0xa", "0x1", "0x100");
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  reopen();
  expect(wallets.pendingChanges()).toEqual({ count: 1, oldestSince: 1000 });
  now = 87399;
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  now = 87400;
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).not.toThrow();
  expect(warnings.at(-1)?.event).toBe("cosigner_wallet_change_accepted");
  expect(wallets.pendingChanges()).toEqual({ count: 0, oldestSince: null });
  reopen();
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).not.toThrow();
  expect(() => wallets.assertWallet("0xa", "0x1", "0x100")).toThrow("cosigner_wallet_change_waiting");
});
test("changing the candidate resets the hold; returning to the known wallet cancels it", () => {
  wallets.assertWallet("0xa", "0x1", "0x100");
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow();
  now = 2000;
  expect(() => wallets.assertWallet("0xa", "0x1", "0x300")).toThrow();
  now = 87400;
  expect(() => wallets.assertWallet("0xa", "0x1", "0x300")).toThrow();
  wallets.assertWallet("0xa", "0x1", "0x100");
  now = 88400;
  expect(() => wallets.assertWallet("0xa", "0x1", "0x300")).toThrow();
  expect(warnings.at(-1)?.notBefore).toBe(174800);
});
test("another gameplay account for the same identity inherits its wallet history", () => {
  wallets.assertWallet("0xa", "0x1", "0x100");
  expect(() => wallets.assertWallet("0xb", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  reopen();
  expect(() => wallets.assertWallet("0xb", "0x2", "0x200")).toThrow("cosigner_account_identity_changed");
  expect(() => wallets.assertWallet("0xa", "0x2", "0x200")).toThrow("cosigner_account_identity_changed");
  expect(() => wallets.assertWallet("0xb", "0x1", "0x100")).not.toThrow();
});
test("initial identities remain a trust boundary; an unknown account and identity have no prior wallet to check", () => {
  wallets.assertWallet("0xa", "0x1", "0x100");
  expect(() => wallets.assertWallet("0xb", "0x2", "0x200")).not.toThrow();
  expect(() => wallets.assertWallet("0xb", "0x2", "0x300")).toThrow("cosigner_wallet_change_waiting");
});
test("unsafe file permissions and invalid identities cannot authorize a payment", () => {
  chmodSync(path, 0o644);
  expect(() => openCosignerWallets(path)).toThrow("cosigner_wallet_file_requires_0600");
  for (const values of [
    ["0", "1", "2"],
    ["1", "-1", "2"],
    ["1", "2", String(2n ** 252n)],
  ]) {
    expect(() => wallets.assertWallet(values[0]!, values[1]!, values[2]!)).toThrow("cosigner_wallet_identity_invalid");
  }
});
test("a reader beside the co-signer sees each hold with its accounts and the watched records, and creates nothing", () => {
  const missing = join(directory, "absent.sqlite");
  expect(readWalletRecords(missing)).toEqual([]);
  expect(existsSync(missing)).toBe(false);
  wallets.assertWallet("0xa", "0x1", "0x100");
  wallets.assertWallet("0xb", "0x1", "0x100");
  wallets.assertWallet("0xc", "0x2", "0x300");
  expect(() => wallets.assertWallet("0xa", "0x1", "0x200")).toThrow("cosigner_wallet_change_waiting");
  expect(readWalletRecords(path)).toEqual([
    { realmsId: "0x1", wallet: "0x100", pending: "0x200", since: 1000, accounts: ["0xa", "0xb"] },
  ]);
  expect(readWalletRecords(path, ["0x2"]).map((record) => record.realmsId)).toEqual(["0x1", "0x2"]);
});
