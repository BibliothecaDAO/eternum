import {
  buildLedgerEconomicPreset,
  buildRegisterLedgerPresetCalldata,
} from "../../../../../../config/deployer/clean/ledger/economics";
import { expect, mock, test } from "bun:test";
import { CallData, byteArray } from "starknet";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSetupCalls, loadSettings, deployAssets, deployDev, writeDevDeployment } from "./dev.js";

const assets = { ledger: "0x123", lords: "0x1", mmr: "0x2", chests: "0x3", cosmetics: "0x4" };
const settings = {
  environment: "staging",
  address: "0x5",
  pauser: "0x6",
  start: 100n,
  end: 200n,
  chestCids: ["one", "two", "three", "four", "five"],
  cosmeticCid: "test",
};

test("deployment settings need no shard or Frontier game inputs", () => {
  const variables = {
    ENVIRONMENT: "staging",
    DEV_ACCOUNT_ADDRESS: "0x5",
    DEV_ACCOUNT_PRIVATE_KEY: "unused-test-key",
    DEV_OPERATOR_ADDRESS: "0x6",
    DEV_PAUSER_ADDRESS: "0x7",
    DEV_SEASON_START: "100",
    DEV_SEASON_END: "200",
    DEV_COSMETIC_CID: "test",
    ...Object.fromEntries([1, 2, 3, 4, 5].map((band) => [`DEV_CHEST_BAND_${band}_CID`, "test"])),
  };
  const saved = { ...process.env };
  try {
    for (const name of Object.keys(process.env)) if (name.startsWith("DEV_")) delete process.env[name];
    Object.assign(process.env, variables);
    const loaded = loadSettings();
    expect(loaded.start).toBe(100n);
    expect(Object.keys(loaded).sort()).toEqual([
      "address",
      "chestCids",
      "cosmeticCid",
      "end",
      "environment",
      "operator",
      "pauser",
      "privateKey",
      "start",
    ]);
  } finally {
    process.env = saved;
  }
});

test("setup registers exactly Blitz and Frontier and opens Blitz without funding a Frontier pool", () => {
  const calls = buildSetupCalls(assets, settings);
  const registrations = calls.filter((call) => call.entrypoint === "register_preset");
  expect(registrations).toEqual([
    {
      contractAddress: assets.ledger,
      entrypoint: "register_preset",
      calldata: buildRegisterLedgerPresetCalldata(1, buildLedgerEconomicPreset("blitz")),
    },
    {
      contractAddress: assets.ledger,
      entrypoint: "register_preset",
      calldata: buildRegisterLedgerPresetCalldata(2, buildLedgerEconomicPreset("frontier")),
    },
  ]);

  expect(calls.some((call) => ["fund_frontier", "mint", "approve"].includes(call.entrypoint))).toBe(false);
  expect(calls.find((call) => call.entrypoint === "open_season")?.calldata).toEqual(["1", "1", "100", "200"]);
});

test("deployment publishes contracts before setup, even when setup fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-setup-"));
  let setups = 0;
  try {
    const account = {
      getChainId: async () => "0x534e5f4d41494e",
      execute: async () => {
        setups++;
        const manifest = JSON.parse(
          await readFile(join(root, "contracts/l2/ledger/target/dev-deployment.json"), "utf8"),
        );
        expect(manifest.ledger).toBe(assets.ledger);
        const book = JSON.parse(await readFile(join(root, "contracts/common/addresses/dev.json"), "utf8"));
        expect(book).toEqual({
          l2Chain: "SN_MAIN",
          ledger: assets.ledger,
          lords: assets.lords,
          mmrToken: assets.mmr,
          lootChests: assets.chests,
          cosmetics: assets.cosmetics,
        });
        throw new Error("setup refused");
      },
    };
    await expect(deployDev(account, settings, root, async () => assets)).rejects.toThrow("setup refused");
    expect(setups).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deployment completes setup without a shard read or Frontier clock", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-complete-"));
  const confirmed: string[] = [];
  try {
    const result = await deployDev(
      {
        getChainId: async () => "0x534e5f4d41494e",
        execute: async () => ({ transaction_hash: "0xabc" }),
        waitForTransaction: async (hash: string) => {
          confirmed.push(hash);
          return { execution_status: "SUCCEEDED" };
        },
      },
      settings,
      root,
      async () => assets,
    );
    expect(result.setupTransaction).toBe("0xabc");
    expect(confirmed).toEqual(["0xabc"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("publishing dev replaces all five assets and preserves Realms and production", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-publish-"));
  try {
    const book = join(root, "contracts/common/addresses/dev.json");
    await mkdir(join(root, "contracts/common/addresses"), { recursive: true });
    await writeFile(
      book,
      JSON.stringify({
        lords: "0x99",
        lootChests: "0x98",
        cosmetics: "0x97",
        chainId: "0x2",
        ledger: "0x3",
        mmrToken: "0x4",
        realms: "0x5",
      }),
    );
    const productionBook = join(root, "contracts/common/addresses/mainnet.json");
    const production = JSON.stringify({ ledger: "0xabc", lords: "0xdef", realms: "0x5" });
    await writeFile(productionBook, production);
    const manifest = { ...assets, mmr: "0x456", seasonId: 1 };
    await writeDevDeployment(manifest, root);
    expect(await readFile(productionBook, "utf8")).toBe(production);
    expect(JSON.parse(await readFile(book, "utf8"))).toEqual({
      l2Chain: "SN_MAIN",
      lootChests: assets.chests,
      cosmetics: assets.cosmetics,
      lords: assets.lords,
      chainId: "0x2",
      ledger: "0x123",
      mmrToken: "0x456",
      realms: "0x5",
    });
    expect(JSON.parse(await readFile(join(root, "contracts/l2/ledger/target/dev-deployment.json"), "utf8"))).toEqual(
      manifest,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test.each(["production", "dev", "sepolia", undefined])("dev settings refuse environment %s", (environment) => {
  const previous = process.env.ENVIRONMENT;
  try {
    if (environment === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = environment;
    expect(loadSettings).toThrow(environment === undefined ? "ENVIRONMENT is required" : "ENVIRONMENT=staging");
  } finally {
    if (previous === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = previous;
  }
});

test("dev deployment refuses another environment or L2 before deploying or writing", async () => {
  const root = await mkdtemp(join(tmpdir(), "dev-refused-"));
  const deploy = mock(async () => assets);
  const execute = mock(async () => ({ transaction_hash: "0xabc" }));
  const account = { getChainId: async () => "0x534e5f5345504f4c4941", execute };
  try {
    await expect(deployDev(account, settings, root, deploy)).rejects.toThrow("Starknet mainnet required");
    await expect(deployDev(account, { ...settings, environment: "production" }, root, deploy)).rejects.toThrow(
      "ENVIRONMENT=staging",
    );
    expect(deploy).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(await readFile(join(root, "contracts/common/addresses/dev.json")).catch(() => null)).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dev deploys a fresh test token, rating token and both collections before its ledger", async () => {
  const calls: { packageName: string; artifact: string; constructor: unknown[] }[] = [];
  const deployed = await deployAssets(
    {},
    { ...settings, operator: "0x6" },
    async (_account, packageName, artifact, constructor) => {
      calls.push({ packageName, artifact, constructor });
      return `0x${calls.length}`;
    },
  );
  expect(calls.map(({ packageName, artifact }) => [packageName, artifact])).toEqual([
    ["ledger", "TestLords"],
    ["mmr", "MMRToken"],
    ["collectibles", "RealmsCollectible"],
    ["collectibles", "RealmsCollectible"],
    ["ledger", "GameLedger"],
  ]);
  for (const [index, name] of [
    [2, "devChest"],
    [3, "devCosmetics"],
  ] as const) {
    expect(calls[index]!.constructor.slice(0, 6)).toEqual(
      CallData.compile([byteArray.byteArrayFromString(name), byteArray.byteArrayFromString(name)]),
    );
  }
  expect(calls[1]!.constructor).toEqual([settings.address, settings.address]);
  expect(calls[4]!.constructor).toEqual([settings.address, "0x6", settings.address, "0x1", "0x2", "0x3", "0x4"]);
  expect(deployed).toEqual({ lords: "0x1", mmr: "0x2", chests: "0x3", cosmetics: "0x4", ledger: "0x5" });
});
