import { hash } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

import { allApplied, gameShardOf, receiptsOf, sentSince } from "./chain-receipts.mjs";

const GAMES = "0x6a";
const shard = { chainId: "0x5331", gameId: 1, rpcUrl: "https://rpc.test/rpc", games: GAMES };
const owner = { throwIfCancelled: () => {}, sleep: async () => {} };
const rejected = (transaction) => ({
  from_address: GAMES,
  keys: [hash.getSelectorFromName("GameplayRejected"), "0x1", "0x1", "0x7", transaction],
  data: ["0x0", "0x0", "0x6e6f206c61626f72", "0x8"],
});
const receipt = (transaction, overrides = {}) => ({
  transaction_hash: transaction,
  block_number: 12,
  finality_status: "ACCEPTED_ON_L2",
  execution_status: "SUCCEEDED",
  events: [],
  ...overrides,
});

const otherEvent = { from_address: "0x77", keys: ["0x1"], data: [] };

function nodeAnswering(byHash) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, { body }) => {
      const { params } = JSON.parse(body);
      const answer = byHash[params.transaction_hash];
      return new Response(
        JSON.stringify(answer ? { result: answer } : { error: { code: 29, message: "Transaction hash not found" } }),
      );
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the actions a step sent", () => {
  it("are the transactions the page recorded since, each once", () => {
    const before = [{ operation: "explore", hash: "0x01" }];
    const now = [...before, { operation: "build", hash: "0x2" }, { operation: "build", hash: "0x02" }];
    expect(sentSince(before, now)).toEqual([{ operation: "build", hash: "0x2" }]);
  });
});

describe("a receipt from the shard's node", () => {
  it("is applied only when confirmed, succeeded and not refused by the game", async () => {
    nodeAnswering({
      "0xa": receipt("0xa"),
      "0xb": receipt("0xb", { events: [rejected("0xb")] }),
      "0xc": receipt("0xc", { execution_status: "REVERTED", revert_reason: "out of gas" }),
    });
    const receipts = await receiptsOf(owner, shard, [
      { operation: "build", hash: "0xa" },
      { operation: "attack", hash: "0xb" },
      { operation: "enter", hash: "0xc" },
    ]);
    expect(receipts.map(({ hash, applied, why }) => ({ hash, applied, why }))).toEqual([
      { hash: "0xa", applied: true, why: null },
      { hash: "0xb", applied: false, why: "refused: no labor" },
      { hash: "0xc", applied: false, why: "out of gas" },
    ]);
    expect(allApplied(receipts)).toBe(false);
    expect(allApplied(receipts.slice(0, 1))).toBe(true);
  });

  it("carries the play's l2 gas and event count, as the node reports them", async () => {
    nodeAnswering({
      "0xe": receipt("0xe", { execution_resources: { l2_gas: "0x2faf080" }, events: Array(3).fill(otherEvent) }),
    });
    const [measured] = await receiptsOf(owner, shard, [{ operation: "move", hash: "0xe" }]);
    expect({ l2Gas: measured.l2Gas, events: measured.events }).toEqual({ l2Gas: 50_000_000, events: 3 });
  });

  it("that never confirms is not applied", async () => {
    nodeAnswering({});
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(120_000);
    const [missing] = await receiptsOf(owner, shard, [{ operation: "build", hash: "0xd" }]);
    expect(missing).toEqual({ operation: "build", hash: "0xd", applied: false, why: "no confirmed receipt" });
    expect(allApplied([])).toBe(false);
  });
});

describe("the game's shard", () => {
  const pageAt = (route, shard) => ({
    read: (expression) =>
      expression.includes("location.pathname") ? route : { status: 200, body: JSON.stringify({ shard }) },
  });
  const listed = {
    chainId: "0x4445565f31",
    manifest: { rpcUrl: "https://rpc.dev.test/rpc/v0_10_2", contracts: { games: "0x9" } },
  };

  it("is the directory's one row when the page's game is on its chain", () => {
    expect(gameShardOf(pageAt("/g/0x4445565f31/3", listed))).toEqual({
      chainId: "0x4445565f31",
      gameId: 3,
      rpcUrl: "https://rpc.dev.test/rpc/v0_10_2",
      games: "0x9",
    });
  });

  it("is refused when the directory lists another chain", () => {
    expect(() => gameShardOf(pageAt("/g/0x53315f/3", listed))).toThrow("The directory lists no shard for 0x53315f");
  });
});
