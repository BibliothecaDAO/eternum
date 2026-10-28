import { afterEach, expect, mock, test } from "bun:test";
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash, num, type Account } from "starknet";
import { deployAsset, publishAssets, retiredPin, type AssetPlan } from "./ledger";
import { PrivateStore } from "./private-store";
import { retire, retirementPlan } from "./retire";
import { addressBook, environments, root, type Target } from "./settings";
import { teardownArguments } from "./teardown";

const cleanup: string[] = [];
afterEach(() => {
  for (const path of cleanup.splice(0)) rmSync(path, { recursive: true, force: true });
});

/** A scratch environment: dev's settings with its own address book and private directory. */
function environment(book: Record<string, unknown>) {
  const name = `.retire-test-${process.pid}-${cleanup.length}.json`;
  const path = join(root, "contracts/common/addresses", name);
  writeFileSync(path, JSON.stringify(book));
  const base = mkdtempSync(join(tmpdir(), "retire-"));
  mkdirSync(join(base, "repo"));
  cleanup.push(path, base);
  return {
    target: { ...environments.dev, book: name } as unknown as Target,
    store: new PrivateStore(join(base, "private"), join(base, "repo"), true),
  };
}

const artifact = (program: string) => ({
  contract: {
    contract_class_version: "0.1.0",
    sierra_program: [program],
    entry_points_by_type: { EXTERNAL: [], L1_HANDLER: [], CONSTRUCTOR: [] },
    abi: [],
  },
  casm: {},
});

/** An account on a chain where only what it deploys exists. */
function chain() {
  const deployed = new Map<string, string>();
  return {
    address: "0x123",
    getClassHashAt: async (address: string) => {
      const found = deployed.get(num.toHex(address));
      if (!found) throw { code: 20 };
      return found;
    },
    getClassByHash: async () => ({}),
    declareIfNot: mock(async () => ({})),
    deployContract: mock(
      async ({
        classHash,
        constructorCalldata,
        salt,
      }: {
        classHash: string;
        constructorCalldata: string[];
        salt: string;
      }) => {
        const address = hash.calculateContractAddressFromHash(salt, classHash, constructorCalldata, 0);
        deployed.set(num.toHex(address), classHash);
        return { transaction_hash: "0x1", address };
      },
    ),
    waitForTransaction: async () => ({ execution_status: "SUCCEEDED" }),
  };
}

test("an existing ledger is retired, a new one deploys and publishes, and every rerun changes nothing", async () => {
  const { target, store } = environment({ l2Chain: "SN_MAIN", lords: "0x11" });
  const account = chain() as unknown as Account & ReturnType<typeof chain>;
  const plan = (constructor: string[]): AssetPlan => ({
    name: "ledger",
    package: "ledger",
    artifact: "GameLedger",
    constructor,
  });
  const assets = { lords: "0x11", mmr: "0x12", chests: "0x13", cosmetics: "0x14" };

  // The deployment today: its ledger pinned in the private directory and named in the book with its block.
  const old = await deployAsset(account, "dev", plan(["0x1"]), artifact("0x1"), store, () => {});
  publishAssets(target, { ...assets, ledger: old }, 100);
  store.write("cold-setup.json", { calls: [] });

  // A new ledger class is refused while the old pin stands.
  await expect(deployAsset(account, "dev", plan(["0x1"]), artifact("0x2"), store, () => {})).rejects.toThrow(
    "Saved deployment differs",
  );

  const changes = retirementPlan(target, store, ["ledger"]);
  expect(changes).toEqual({
    moves: [
      ["asset-ledger.json", retiredPin("ledger", old)],
      ["cold-setup.json", `retired-cold-setup-${num.toHex(old)}.json`],
    ],
    keys: ["ledger", "ledgerDeploymentBlock"],
  });
  retire(target, store, changes);
  // Only the ledger leaves the book: the token, rating token and collections stay for the new ledger.
  expect(addressBook(target)).toEqual({
    l2Chain: "SN_MAIN",
    lords: "0x11",
    mmrToken: "0x12",
    lootChests: "0x13",
    cosmetics: "0x14",
  });
  expect(retirementPlan(target, store, ["ledger"])).toEqual({ moves: [], keys: [] });

  // The new ledger deploys at its own address and publishes with its own block; a rerun of both changes nothing.
  const fresh = await deployAsset(account, "dev", plan(["0x1"]), artifact("0x2"), store, () => {});
  expect(num.toHex(fresh)).not.toBe(num.toHex(old));
  publishAssets(target, { ...assets, ledger: fresh }, 200);
  expect(await deployAsset(account, "dev", plan(["0x1"]), artifact("0x2"), store, () => {})).toBe(fresh);
  publishAssets(target, { ...assets, ledger: fresh }, 200);
  expect(addressBook(target)).toMatchObject({ ledger: fresh, ledgerDeploymentBlock: 200, lords: "0x11" });
  expect(account.deployContract).toHaveBeenCalledTimes(2);
});

test("a retired contract is never deployed again at its address: its constructor or deployer must change", async () => {
  const { target, store } = environment({ l2Chain: "SN_MAIN" });
  const account = chain() as unknown as Account;
  const plan: AssetPlan = { name: "mmr", package: "mmr", artifact: "MMRToken", constructor: ["0xad", "0xad"] };
  const old = await deployAsset(account, "dev", plan, artifact("0x3"), store, () => {});
  publishAssets(target, { ledger: "0x10", lords: "0x11", mmr: old, chests: "0x13", cosmetics: "0x14" }, 100);
  retire(target, store, retirementPlan(target, store, ["mmr"]));
  expect(addressBook(target).mmrToken).toBeUndefined();
  await expect(deployAsset(account, "dev", plan, artifact("0x3"), store, () => {})).rejects.toThrow(
    "The retired mmr has this address",
  );
  const fresh = await deployAsset(
    account,
    "dev",
    { ...plan, constructor: ["0xbe", "0xbe"] },
    artifact("0x3"),
    store,
    () => {},
  );
  expect(num.toHex(fresh)).not.toBe(num.toHex(old));
});

test("a retirement cut short finishes on the next run, and a pin naming another contract refuses", () => {
  const { target, store } = environment({ l2Chain: "SN_MAIN", ledger: "0x10", ledgerDeploymentBlock: 5 });
  store.write("asset-ledger.json", { classHash: "0x1", address: "0x10", constructor: [] });
  // The pin moved, then the run stopped before the book was written.
  store.rename("asset-ledger.json", retiredPin("ledger", "0x10"));
  expect(retirementPlan(target, store, ["ledger"])).toEqual({ moves: [], keys: ["ledger", "ledgerDeploymentBlock"] });
  retire(target, store, retirementPlan(target, store, ["ledger"]));
  expect(addressBook(target)).toEqual({ l2Chain: "SN_MAIN" });

  const other = environment({ l2Chain: "SN_MAIN", ledger: "0x10" });
  other.store.write("asset-ledger.json", { address: "0x99" });
  expect(() => retirementPlan(other.target, other.store, ["ledger"])).toThrow("another contract than the book");
  expect(readdirSync(other.store.directory)).toContain("asset-ledger.json");
});

test("teardown takes dev alone, or either environment with one backup under /opt/athanor/backups", () => {
  expect(teardownArguments(["dev"])).toEqual({ environment: "dev", invocation: "teardown dev" });
  expect(teardownArguments(["dev", "/opt/athanor/backups/rehearsal"]).invocation).toBe(
    "teardown dev '/opt/athanor/backups/rehearsal'",
  );
  expect(teardownArguments(["production", "/opt/athanor/backups/s0-20261102"]).invocation).toBe(
    "teardown production '/opt/athanor/backups/s0-20261102'",
  );
  for (const args of [
    ["production"],
    ["production", "/opt/athanor/backups/.."],
    ["production", "/opt/athanor/backups/a/b"],
    ["production", "/tmp/s0"],
    ["dev", "/tmp/s0"],
    ["staging"],
  ])
    expect(() => teardownArguments(args)).toThrow("Usage: pnpm run teardown");
});
