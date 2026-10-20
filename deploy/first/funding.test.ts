import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Account, Call } from "starknet";
import * as main from "./main";
import * as box from "./box";
import * as native from "../../contracts/l2/ledger/scripts/commands/deployment/fund-frontier";
import * as funding from "../../packages/value-ledger/src/frontier-funding";
import { transactionIntentName } from "./chain";
import { runSteps } from "./run";
import { seasonSteps } from "./season-steps";
import { PrivateStore } from "./private-store";
import { environments, WEI } from "./settings";

const originalFetch = globalThis.fetch;
const temporary: string[] = [];
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

test.each([
  "game",
  "chain",
  "lost mint reply",
  "lost deposit reply",
  "unsent mint",
  "unsent deposit",
  "lagged mint reply",
  "lagged deposit reply",
])("Frontier funding recovers %s without paying twice", async (changes) => {
  const base = mkdtempSync(join(tmpdir(), "frontier-mint-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  const start = "2027-02-01T00:00:00Z";
  const startSeconds = Date.parse(start) / 1000;
  let gameId = 1;
  let chainId = "0x10";
  let held = 0n;
  const submitted: Call[][] = [];
  let funded = false;
  let interrupted = false;
  let nonce = 0;
  let observedBlock: number | undefined;
  const blocks = new Map<number, { nonce: number; held: bigint; funded: boolean }>();
  const remember = () => blocks.set(nonce, { nonce, held, funded });
  const stateAt = (block?: number) => {
    remember();
    return blocks.get(block ?? nonce)!;
  };
  const account = {
    address: "0x123",
    getBlockNumber: async () => observedBlock ?? nonce,
    getNonce: async (block?: number) => String(stateAt(block).nonce),
    callContract: async (_call: unknown, block?: number) => [String(stateAt(block).held), "0"],
    execute: async (calls: Call[], options: { nonce: string }) => {
      if (options.nonce !== String(nonce)) throw new Error("stale nonce");
      remember();
      const operation = calls[0]!.entrypoint === "mint" ? "mint" : "deposit";
      if (!interrupted && changes === `unsent ${operation}`) {
        interrupted = true;
        throw new Error("before submission");
      }
      if (operation === "deposit" && funded) throw new Error("season already funded");
      nonce++;
      submitted.push(calls);
      if (operation === "deposit") funded = true;
      held = calls[0]!.entrypoint === "mint" ? 1000n * WEI : 0n;
      if (!interrupted && (changes === `lost ${operation} reply` || changes === `lagged ${operation} reply`)) {
        interrupted = true;
        throw new Error("reply lost");
      }
      return { transaction_hash: `0x${submitted.length}` };
    },
    waitForTransaction: async () => ({ execution_status: "SUCCEEDED", finality_status: "ACCEPTED_ON_L2" }),
  };
  spyOn(main, "signer").mockReturnValue(account as unknown as Account);
  spyOn(box, "nativeDocument").mockImplementation(async () => ({ shard: { chainId }, world: { address: "0x20" } }));
  spyOn(native, "readFrontierGame").mockResolvedValue({
    presetId: 2,
    start: startSeconds,
    end: startSeconds + 20 * 86400,
    seed: "1",
    dayUnit: 86400,
    claimWindow: 86400,
  });
  spyOn(funding, "readFrontierFunding").mockImplementation(async (_provider, _ledger, _key, _native, block) => {
    if (!stateAt(block).funded) throw new Error("frontier_funding_missing");
    return {
      pool: String(1000n * WEI),
      paid: "0",
      closed: false,
      presetId: 2,
      seed: "1",
      start: startSeconds,
      end: startSeconds + 20 * 86400,
      claimDeadline: startSeconds + 21 * 86400,
      confirmedBlock: 1,
    };
  });
  globalThis.fetch = (async (url, _init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/factory/calendar") return Response.json({ phases: [{ phase: "frontier", startsAt: start }] });
    if (path === "/games")
      return Response.json({
        games: [{ game_id: gameId, mode: "frontier", clock: { start_main_at: startSeconds } }],
      });
    if (path === "/manifest") return Response.json({ chainId });
    throw new Error("Unexpected test request");
  }) as typeof fetch;
  const context = {
    apply: true,
    target: environments.dev,
    inputs: { frontierStart: start, amount: "1000" },
    assets: { ledger: "0x1", lords: "0x2" },
    store,
    output: () => {},
    provider: {
      getBlockNumber: async () => observedBlock ?? nonce,
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        if (entrypoint === "get_preset") return [...Array(16).fill("0"), "86400", "86400"];
        if (entrypoint === "lords") return ["0x2"];
        throw new Error("Unexpected ledger read");
      },
    },
  } as unknown as main.Deployment;
  const step = seasonSteps(context).find((step) => step.name === "Frontier deposit")!;
  if (changes !== "game" && changes !== "chain") {
    await expect(runSteps([step], true, () => {})).rejects.toThrow(
      changes.endsWith("reply") ? "reply lost" : "before submission",
    );
    // Another operation consumes the failed attempt's nonce before this command is retried.
    if (changes.startsWith("unsent")) nonce++;
    if (changes.startsWith("lagged")) {
      // An older effect-read backend answers before the nonce backend observes the lost transaction.
      observedBlock = nonce - 1;
      const paid = submitted.length;
      await expect(runSteps([step], true, () => {})).rejects.toThrow("stale nonce");
      expect(submitted).toHaveLength(paid);
      observedBlock = undefined;
    }
    expect(await runSteps([step], true, () => {})).toBe(true);
    expect(await runSteps([step], true, () => {})).toBe(true);
    expect(submitted.map((calls) => calls[0]!.entrypoint)).toEqual(["mint", "approve"]);
    return;
  }
  await runSteps([step], true, () => {});
  funded = false;
  if (changes === "game") gameId = 2;
  else chainId = "0x11";
  await step.apply();
  expect(submitted.map((calls) => calls[0]!.entrypoint)).toEqual(["mint", "approve", "mint", "approve"]);
  expect(store.read(transactionIntentName(account, submitted[0]!, "test-tokens-0x10-1"))).toMatchObject({
    hash: "0x1",
  });
  expect(store.read(transactionIntentName(account, submitted[2]!, `test-tokens-${chainId}-${gameId}`))).toMatchObject({
    hash: "0x3",
  });
  expect(store.read(transactionIntentName(account, submitted[3]!, `frontier-${chainId}-${gameId}`))).toMatchObject({
    hash: "0x4",
  });
});

test.each([
  ["lacks the deposit", 0n, ["mint", "approve", "fund_frontier"]],
  ["holds the deposit", 1000n * WEI, ["approve", "fund_frontier"]],
] as const)("Cold-admin funding mints test LORDS to the cold admin only when it %s", async (_case, held, calls) => {
  const base = mkdtempSync(join(tmpdir(), "frontier-cold-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  const start = "2027-02-01T00:00:00Z";
  const startSeconds = Date.parse(start) / 1000;
  const coldAdmin = "0xc01d";
  const balanceOwners: string[] = [];
  const account = {
    address: "0x123",
    getBlockNumber: async () => 7,
    callContract: async (call: { calldata: string[] }) => {
      balanceOwners.push(call.calldata[0]!);
      return [String(held), "0"];
    },
    execute: async () => {
      throw new Error("The deployer must not pay a cold admin's deposit");
    },
  };
  spyOn(main, "signer").mockReturnValue(account as unknown as Account);
  spyOn(box, "nativeDocument").mockImplementation(async () => ({
    shard: { chainId: "0x10" },
    world: { address: "0x20" },
  }));
  spyOn(native, "readFrontierGame").mockResolvedValue({
    presetId: 5,
    start: startSeconds,
    end: startSeconds + 20 * 86400,
    seed: "1",
    dayUnit: 86400,
    claimWindow: 86400,
  });
  spyOn(funding, "readFrontierFunding").mockRejectedValue(new Error("frontier_funding_missing"));
  globalThis.fetch = (async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/factory/calendar") return Response.json({ phases: [{ phase: "frontier", startsAt: start }] });
    if (path === "/games")
      return Response.json({ games: [{ game_id: 1, mode: "frontier", clock: { start_main_at: startSeconds } }] });
    if (path === "/manifest") return Response.json({ chainId: "0x10" });
    throw new Error("Unexpected test request");
  }) as typeof fetch;
  const context = {
    apply: true,
    target: { ...environments.dev, coldAdmin: true },
    inputs: { frontierStart: start, amount: "1000", admin: coldAdmin },
    assets: { ledger: "0x1", lords: "0x2" },
    store,
    output: () => {},
    provider: {
      getBlockNumber: async () => 7,
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        if (entrypoint === "get_preset") return [...Array(16).fill("0"), "86400", "86400"];
        if (entrypoint === "lords") return ["0x2"];
        throw new Error("Unexpected ledger read");
      },
    },
  } as unknown as main.Deployment;
  await seasonSteps(context)
    .find((step) => step.name === "Frontier deposit")!
    .apply();
  const written = store.read<{ account: string; calls: Call[] }>("cold-funding.json")!;
  expect(balanceOwners).toEqual([coldAdmin]);
  expect(written.account).toBe(coldAdmin);
  expect(written.calls.map((call) => call.entrypoint)).toEqual([...calls]);
  if (held === 0n)
    expect(written.calls[0]).toEqual({
      contractAddress: "0x2",
      entrypoint: "mint",
      calldata: [BigInt(coldAdmin).toString(), String(1000n * WEI), "0"],
    });
});
