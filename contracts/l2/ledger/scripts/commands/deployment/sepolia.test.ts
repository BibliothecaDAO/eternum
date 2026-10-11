import {
  buildPlayerGameLedgerPreset,
  buildRegisterLedgerPresetCalldata,
} from "../../../../../../config/deployer/clean/ledger/economics";
import { PLAYER_GAME_LEDGER_PRESET_ID } from "../../../../../../config/source/common/ledger-presets";
import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSetupCalls, loadSettings, deploySepolia, writeSepoliaDeployment } from "./sepolia.js";

const assets = { ledger: "0x123", lords: "0x1", mmr: "0x2", chests: "0x3", cosmetics: "0x4" };
const settings = {
  address: "0x5",
  pauser: "0x6",
  start: 100n,
  end: 200n,
  chestCids: ["one", "two", "three", "four", "five"],
  cosmeticCid: "test",
};

test("deployment settings need no shard or Frontier game inputs", () => {
  const variables = {
    SEPOLIA_ACCOUNT_ADDRESS: "0x5",
    SEPOLIA_ACCOUNT_PRIVATE_KEY: "unused-test-key",
    SEPOLIA_OPERATOR_ADDRESS: "0x6",
    SEPOLIA_PAUSER_ADDRESS: "0x7",
    SEPOLIA_SEASON_START: "100",
    SEPOLIA_SEASON_END: "200",
    SEPOLIA_COSMETIC_CID: "test",
    ...Object.fromEntries([1, 2, 3, 4, 5].map((band) => [`SEPOLIA_CHEST_BAND_${band}_CID`, "test"])),
  };
  const saved = { ...process.env };
  try {
    for (const name of Object.keys(process.env)) if (name.startsWith("SEPOLIA_")) delete process.env[name];
    Object.assign(process.env, variables);
    const loaded = loadSettings();
    expect(loaded.start).toBe(100n);
    expect(Object.keys(loaded).sort()).toEqual([
      "address",
      "chestCids",
      "cosmeticCid",
      "end",
      "operator",
      "pauser",
      "privateKey",
      "start",
    ]);
  } finally {
    process.env = saved;
  }
});

test("setup registers all presets and Blitz without funding or minting a Frontier pool", () => {
  const calls = buildSetupCalls(assets, settings);
  const registrations = calls.filter((call) => call.entrypoint === "register_preset");
  expect(registrations.map((call) => call.calldata[0])).toEqual(["1", "2", String(PLAYER_GAME_LEDGER_PRESET_ID)]);
  const player = registrations[2]!;
  expect(player.contractAddress).toBe(assets.ledger);
  expect(player.calldata).toEqual(
    buildRegisterLedgerPresetCalldata(PLAYER_GAME_LEDGER_PRESET_ID, buildPlayerGameLedgerPreset("sepolia")),
  );
  expect(player.calldata.slice(1, 3)).toEqual([String(10n ** 18n), "0"]);

  expect(calls.some((call) => ["fund_frontier", "mint", "approve"].includes(call.entrypoint))).toBe(false);
  expect(calls.find((call) => call.entrypoint === "open_season")?.calldata).toEqual(["1", "1", "100", "200"]);
});

test("deployment publishes contracts before setup, even when setup fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "sepolia-setup-"));
  let setups = 0;
  try {
    const account = {
      getChainId: async () => "0x534e5f5345504f4c4941",
      execute: async () => {
        setups++;
        const manifest = JSON.parse(
          await readFile(join(root, "contracts/l2/ledger/target/sepolia-deployment.json"), "utf8"),
        );
        expect(manifest.ledger).toBe(assets.ledger);
        const book = JSON.parse(await readFile(join(root, "contracts/common/addresses/sepolia.json"), "utf8"));
        expect(book).toEqual({ ledger: assets.ledger, mmrToken: assets.mmr });
        throw new Error("setup refused");
      },
    };
    await expect(deploySepolia(account, settings, root, async () => assets)).rejects.toThrow("setup refused");
    expect(setups).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("deployment completes setup without a shard read or Frontier clock", async () => {
  const root = await mkdtemp(join(tmpdir(), "sepolia-complete-"));
  const confirmed: string[] = [];
  try {
    const result = await deploySepolia(
      {
        getChainId: async () => "0x534e5f5345504f4c4941",
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

test("publishing Sepolia replaces ledger and rating addresses and preserves unrelated entries", async () => {
  const root = await mkdtemp(join(tmpdir(), "sepolia-publish-"));
  try {
    const book = join(root, "contracts/common/addresses/sepolia.json");
    await mkdir(join(root, "contracts/common/addresses"), { recursive: true });
    await writeFile(
      book,
      JSON.stringify({ lords: "0x1", chainId: "0x2", ledger: "0x3", mmrToken: "0x4", realms: "0x5" }),
    );
    const manifest = { ledger: "0x123", mmr: "0x456", seasonId: 1 };
    await writeSepoliaDeployment(manifest, root);
    expect(JSON.parse(await readFile(book, "utf8"))).toEqual({
      lords: "0x1",
      chainId: "0x2",
      ledger: "0x123",
      mmrToken: "0x456",
      realms: "0x5",
    });
    expect(
      JSON.parse(await readFile(join(root, "contracts/l2/ledger/target/sepolia-deployment.json"), "utf8")),
    ).toEqual(manifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
