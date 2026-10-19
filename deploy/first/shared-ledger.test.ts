import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CallData, type Account, type Call, type RpcProvider } from "starknet";
import { accountIdentity, type Keys } from "./chain";
import { LEDGER_ROLES } from "./ledger";
import { preparationSteps, type Deployment } from "./main";
import { PrivateStore } from "./private-store";
import { runSteps } from "./run";
import { environments, ownsValueLedger, WEI } from "./settings";
import { reserveStep, roleSteps, sharedLedgerRoles } from "./shared-ledger";

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
// Deliberately public throwaway test scalars. These never leave the fake ledger below.
const devKeys: Keys = { deployer: "0x123", relay: "0x124", monitor: "0x125", launcher: "0x126", shardRelay: "0x127" };
const productionKeys: Keys = {
  deployer: "0x223",
  relay: "0x224",
  monitor: "0x225",
  launcher: "0x226",
  shardRelay: "0x227",
};
const address = (key: string) => BigInt(accountIdentity(key).address).toString();
const LEDGER = "0x10";

/** A ledger holding roles and STRK balances, whose admin account applies its calls as the contracts do. */
function fakeLedger(held: [string, string][], strk: Record<string, bigint> = {}) {
  const roles = new Set(held.map(([role, key]) => `${BigInt(role)}:${address(key)}`));
  const balances = new Map(Object.entries(strk).map(([key, amount]) => [address(key), amount]));
  const sent: Call[] = [];
  const provider = {
    getBlockNumber: async () => 100,
    getClassHashAt: async () => {
      throw { code: 20 };
    },
    callContract: async (call: Call) => {
      const [first, second] = (call.calldata as string[]).map((value) => BigInt(value).toString());
      if (call.entrypoint === "balance_of") {
        const amount = balances.get(first!) ?? 0n;
        return [String(amount & (2n ** 128n - 1n)), String(amount >> 128n)];
      }
      return [roles.has(`${first}:${second}`) ? "0x1" : "0x0"];
    },
  } as unknown as RpcProvider;
  const admin = {
    address: accountIdentity(devKeys.deployer).address,
    getNonce: async () => String(sent.length),
    execute: async (calls: Call[]) => {
      for (const call of calls) {
        sent.push(call);
        const [first, second] = CallData.compile(call.calldata!).map((value) => BigInt(value).toString());
        if (call.entrypoint === "transfer") {
          const from = address(devKeys.deployer);
          balances.set(from, (balances.get(from) ?? 0n) - BigInt(second!));
          balances.set(first!, (balances.get(first!) ?? 0n) + BigInt(second!));
        } else if (call.entrypoint === "grant_role") roles.add(`${first}:${second}`);
        else roles.delete(`${first}:${second}`);
      }
      return { transaction_hash: `0x${sent.length.toString(16)}` };
    },
    waitForTransaction: async () => ({ execution_status: "SUCCEEDED" }),
  } as unknown as Account;
  return { provider, admin, sent };
}
function store() {
  const base = mkdtempSync(join(tmpdir(), "shared-ledger-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  return new PrivateStore(join(base, "private"), join(base, "repo"), true);
}

test("while production reads dev's book, only production sets up the ledger they share", async () => {
  expect(environments.production.book).toBe(environments.dev.book);
  expect(ownsValueLedger(environments.dev)).toBe(false);
  expect(ownsValueLedger(environments.production)).toBe(true);
  const ledgerSetup = (environment: "dev" | "production") => {
    const context: Deployment = {
      environment,
      target: environments[environment],
      revision: "a".repeat(40),
      store: store(),
      apply: false,
      output: () => {},
    };
    return preparationSteps(context)
      .find((step) => step.name === "Ledger setup")!
      .inspect();
  };
  // Dev reads nothing and prepares no role, preset or season: no pause role for its monitor, no season of its own.
  expect(await ledgerSetup("dev")).toMatchObject({ done: true });
  expect(await ledgerSetup("production")).toMatchObject({ done: false });
});

test("grants production's deployer and relay their roles, takes dev's monitor's pause, and sends each change once", async () => {
  const ledger = fakeLedger([
    [LEDGER_ROLES.admin, devKeys.deployer],
    [LEDGER_ROLES.pauser, devKeys.monitor],
    [LEDGER_ROLES.operator, productionKeys.relay],
  ]);
  const context = { provider: ledger.provider, admin: ledger.admin, ledger: LEDGER, store: store(), output: () => {} };
  const steps = roleSteps(context, sharedLedgerRoles(devKeys, productionKeys));
  expect(steps.map((step) => step.name)).toEqual([
    "admin role for production's deployer",
    "operator role for production's relay",
    "no pause role for dev's monitor",
  ]);
  // A dry run reads every role and sends nothing.
  expect(await runSteps(steps, false, () => {})).toBe(true);
  expect(ledger.sent).toEqual([]);
  expect(await runSteps(steps, true, () => {})).toBe(true);
  expect(ledger.sent.map((call) => [call.entrypoint, ...CallData.compile(call.calldata!).map(BigInt)])).toEqual([
    ["grant_role", BigInt(LEDGER_ROLES.admin), BigInt(address(productionKeys.deployer))],
    ["revoke_role", BigInt(LEDGER_ROLES.pauser), BigInt(address(devKeys.monitor))],
  ]);
  for (const step of steps) expect((await step.inspect()).done).toBe(true);
  // A second run finds every role as wanted and sends nothing more.
  expect(await runSteps(steps, true, () => {})).toBe(true);
  expect(ledger.sent).toHaveLength(2);
});

test("sends nothing when dev's deployer is not the ledger's admin", async () => {
  const ledger = fakeLedger([]);
  const context = { provider: ledger.provider, admin: ledger.admin, ledger: LEDGER, store: store(), output: () => {} };
  await expect(
    runSteps(roleSteps(context, sharedLedgerRoles(devKeys, productionKeys)), true, () => {}),
  ).rejects.toThrow("not the ledger admin");
  expect(ledger.sent).toEqual([]);
});

test("tops production's deployer up to its 50 STRK reserve from dev's deployer, once, and refuses a shortfall", async () => {
  const deployer = accountIdentity(productionKeys.deployer).address;
  const ledger = fakeLedger([], { [devKeys.deployer]: 143n * WEI, [productionKeys.deployer]: 10n * WEI });
  const context = { provider: ledger.provider, admin: ledger.admin, ledger: LEDGER, store: store(), output: () => {} };
  const step = reserveStep(context, deployer);
  expect(await runSteps([step], true, () => {})).toBe(true);
  expect(ledger.sent.map((call) => CallData.compile(call.calldata!).map(BigInt))).toEqual([
    [BigInt(deployer), 40n * WEI, 0n],
  ]);
  expect(await runSteps([step], true, () => {})).toBe(true);
  expect(ledger.sent).toHaveLength(1);
  const poor = fakeLedger([], { [devKeys.deployer]: 5n * WEI });
  const short = { ...context, provider: poor.provider, admin: poor.admin };
  await expect(runSteps([reserveStep(short, deployer)], true, () => {})).rejects.toThrow("less STRK");
  expect(poor.sent).toEqual([]);
});
