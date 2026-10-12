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

test.each(["game", "chain"])("a succeeded Frontier mint and deposit cannot satisfy another %s", async (changes) => {
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
  const account = {
    address: "0x123",
    getNonce: async () => String(submitted.length),
    callContract: async () => [String(held), "0"],
    execute: async (calls: Call[]) => {
      submitted.push(calls);
      held = calls[0]!.entrypoint === "mint" ? 1000n * WEI : 0n;
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
  spyOn(funding, "readFrontierFunding").mockRejectedValue(new Error("frontier_funding_missing"));
  globalThis.fetch = (async (url, _init) => {
    const path = new URL(String(url)).pathname;
    if (path === "/api/factory/calendar") return Response.json({ phases: [{ phase: "frontier", startsAt: start }] });
    if (path === "/games")
      return Response.json({ games: [{ game_id: gameId, mode: "frontier", clock: { start_main_at: startSeconds } }] });
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
      callContract: async ({ entrypoint }: { entrypoint: string }) => {
        if (entrypoint === "get_preset") return [...Array(16).fill("0"), "86400", "86400"];
        if (entrypoint === "lords") return ["0x2"];
        throw new Error("Unexpected ledger read");
      },
    },
  } as unknown as main.Deployment;
  const step = seasonSteps(context).find((step) => step.name === "Frontier deposit")!;
  await step.apply();
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
