import { expect, test, spyOn } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as artifacts from "../../../../../scripts-runtime/js/artifacts.js";
import { buildSetupCalls, loadSettings, readFundedFrontier, writeSepoliaDeployment } from "./sepolia.js";

test("Frontier funding requires an explicit non-zero shard game id", () => {
  const saved = process.env.SEPOLIA_FRONTIER_SEASON_ID;
  try {
    for (const value of [undefined, "", "0", "-1", "4294967296"]) {
      if (value === undefined) delete process.env.SEPOLIA_FRONTIER_SEASON_ID;
      else process.env.SEPOLIA_FRONTIER_SEASON_ID = value;
      expect(() => loadSettings()).toThrow("SEPOLIA_FRONTIER_SEASON_ID");
    }
  } finally {
    if (saved === undefined) delete process.env.SEPOLIA_FRONTIER_SEASON_ID;
    else process.env.SEPOLIA_FRONTIER_SEASON_ID = saved;
  }
});

test("setup and funded-pool verification use the shard game id independently of Blitz season 1", async () => {
  const assets = { ledger: "0x123", lords: "0x1", mmr: "0x2", chests: "0x3", cosmetics: "0x4" };
  const settings = {
    address: "0x5",
    pauser: "0x6",
    shard: "0x7",
    frontierSeasonId: 42n,
    start: 100n,
    end: 200n,
    seed: 24301n,
    pool: 1000n,
    chestCids: ["one", "two", "three", "four", "five"],
    cosmeticCid: "test",
  };
  const calls = buildSetupCalls(assets, settings);
  expect(calls.find((call) => call.entrypoint === "fund_frontier")?.calldata.slice(0, 2)).toEqual(["7", "42"]);
  expect(calls.find((call) => call.entrypoint === "open_season")?.calldata.slice(0, 2)).toEqual(["1", "1"]);
  const reads: unknown[] = [];
  const resolveArtifacts = artifacts.getContractArtifactPaths;
  const fixtureArtifacts = spyOn(artifacts, "getContractArtifactPaths").mockImplementation((directory, ...args) =>
    resolveArtifacts(directory.replace("/target/release", "/target/dev"), ...args),
  );
  try {
    await readFundedFrontier(
      {
        async callContract(call: unknown) {
          reads.push(call);
          return ["1", "100", "200", "1000", "0", "0", "0", "0", "2", "24301"];
        },
      },
      assets,
      settings,
    );
  } finally {
    fixtureArtifacts.mockRestore();
  }
  expect(reads).toEqual([{ contractAddress: "0x123", entrypoint: "get_frontier", calldata: ["7", "42"] }]);
});

test("publishing Sepolia preserves the address book and records the funded game id", async () => {
  const root = await mkdtemp(join(tmpdir(), "sepolia-publish-"));
  try {
    const book = join(root, "contracts/common/addresses/sepolia.json");
    await mkdir(join(root, "contracts/common/addresses"), { recursive: true });
    await writeFile(book, JSON.stringify({ lords: "0x1", chainId: "0x2", ledger: "0x3" }));
    const manifest = { ledger: "0x123", seasonId: 1, frontierSeasonId: "42" };
    await writeSepoliaDeployment(manifest, root);
    expect(JSON.parse(await readFile(book, "utf8"))).toEqual({ lords: "0x1", chainId: "0x2", ledger: "0x123" });
    expect(
      JSON.parse(await readFile(join(root, "contracts/l2/ledger/target/sepolia-deployment.json"), "utf8")),
    ).toEqual(manifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
