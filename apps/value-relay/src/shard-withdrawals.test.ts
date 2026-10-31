import { hash, shortString } from "starknet";
import { ledgerCall } from "../../../packages/value-ledger/test-support/ledger-abi";
import { gamesAbi, gamesEventAbi as abi, withdrawalEvent } from "../../../packages/value-ledger/test-support/abi";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { ShardReader, readFirstRelease, shardConnection } from "./shard-rpc";
import { shardWithdrawalPorts } from "./shard-withdrawals";
import { RelayFailure } from "./ports";
import { SHARD_PAGE_BLOCKS } from "./shard-page";
import { frontierPayment } from "./adapters";

const rpc = vi.hoisted(() => ({
  classHash: vi.fn(),
  chain: vi.fn(),
  header: vi.fn(),
  block: vi.fn(),
  hashes: vi.fn(),
  events: vi.fn(),
  contract: vi.fn(),
  receipt: vi.fn(),
  call: vi.fn(),
  batch: vi.fn(),
}));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  // A batch of header reads answers each call as the node's single read would.
  rpcBatch: async (url: string, method: string, calls: { block_id: { block_number: number } }[]) => {
    rpc.batch(url, method, calls.length);
    return Promise.all(calls.map(({ block_id }) => rpc.header(block_id.block_number)));
  },
  rpcAt: () => ({
    getEvents: rpc.events,
    getChainId: rpc.chain,
    getBlock: rpc.header,
    getBlockWithReceipts: rpc.block,
    getBlockWithTxHashes: rpc.hashes,
    getClassHashAt: rpc.classHash,
    getClassByHash: rpc.contract,
    getTransactionReceipt: rpc.receipt,
    callContract: rpc.call,
  }),
}));
const address = "0x10";
const event = () => ({ from_address: address, ...withdrawalEvent(7, "0xabc", "0x123", 17) });
const receipt = () => ({
  transaction_hash: "0xabc",
  block_number: 10,
  block_hash: "0xa",
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
  events: [event()],
});
const emitted = () => ({ ...event(), transaction_hash: "0xabc", block_number: 10, block_hash: "0xa" });
const header = { block_number: 10, block_hash: "0xa", parent_hash: "0x9", timestamp: 1000, status: "ACCEPTED_ON_L2" };
const fixture = () => {
  const reader = new ShardReader({
    chainId: "0x1",
    rpcUrl: "https://shard.test/rpc",
    gamesAddress: address,
    firstRelease: 1,
  });
  const bindings = {
    realmsIdForAccount: vi.fn(async (_account: string) => "0x2"),
    frontierSeason: vi.fn(() => Effect.succeed(3)),
  };
  return { reader, bindings, ports: shardWithdrawalPorts(reader, bindings) };
};
let classVersion = 0;
beforeEach(() => {
  vi.clearAllMocks();
  rpc.classHash.mockResolvedValue(`0x${(++classVersion).toString(16)}`);
  rpc.chain.mockResolvedValue("0x1");
  rpc.header.mockResolvedValue(header);
  rpc.contract.mockResolvedValue({ abi });
  rpc.receipt.mockResolvedValue(receipt());
  rpc.events.mockResolvedValue({ events: [emitted()] });
  // A shard with no release registered: the Games class alone declares its events.
  rpc.call.mockResolvedValue(["0x0"]);
});
it("reads a confirmed debit receipt and pays exact wei to the resolved account's wallet", async () => {
  const f = fixture();
  const block = await Effect.runPromise(f.ports.eventsPage(10, 10, null));
  expect(block.withdrawals).toEqual([
    {
      prizeRank: 0,
      prizeCount: 0,
      blockNumber: 10,
      chainId: "0x1",
      seasonId: 3,
      transactionHash: "0xabc",
      realmsId: "0x2",
      amount: "17000000000000000000",
      confirmedAt: 1000,
    },
  ]);
  const submit = vi.fn(async (_entrypoint: string, _calldata: readonly string[]) => {});
  await Effect.runPromise(frontierPayment(submit)(block.withdrawals[0]!, "0x456"));
  expect(submit).toHaveBeenCalledWith("pay", ["0x1", "3", "0xabc", "0x456", "17000000000000000000", "0"]);
  expect(submit.mock.calls[0]![1].map(BigInt)).toEqual(
    ledgerCall("pay", {
      shard: 1,
      season_id: 3,
      claim_id: "0xabc",
      wallet: "0x456",
      amount: { low: "17000000000000000000", high: 0 },
    }).map(BigInt),
  );
  expect(rpc.classHash).toHaveBeenCalledWith(address, 10);
  expect(f.bindings.realmsIdForAccount).toHaveBeenCalledWith("0x123");
});
it("does not infer a season when its funding binding is unavailable", async () => {
  const f = fixture();
  f.bindings.frontierSeason.mockReturnValue(Effect.fail(new RelayFailure({ operation: "binding_missing" })) as never);
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "binding_missing" }],
  });
});
it("rejects unconfirmed blocks, wrong chain and transaction/claim mismatches", async () => {
  const f = fixture();
  rpc.header.mockResolvedValueOnce({ ...header, status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.eventsPage(10, 10, null))).rejects.toThrow();
  rpc.events.mockResolvedValueOnce({ events: [{ ...emitted(), block_hash: "0xb" }] });
  await expect(Effect.runPromise(f.ports.eventsPage(10, 10, null))).rejects.toThrow();
  const forged = emitted();
  forged.data[2] = "0xdef";
  rpc.events.mockResolvedValue({ events: [forged] });
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "decode withdrawal receipt" }],
  });
  rpc.chain.mockResolvedValue("0x2");
  await expect(Effect.runPromise(f.ports.confirmedHead())).rejects.toThrow();
});
it("only a missing confirmed receipt is null; transport faults and pending receipts fail closed", async () => {
  const f = fixture();
  rpc.receipt.mockRejectedValueOnce({ code: 29 });
  expect(await Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).toBeNull();
  rpc.receipt.mockRejectedValueOnce(new Error("network offline"));
  await expect(Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).rejects.toThrow();
  rpc.receipt.mockResolvedValue({ ...receipt(), block_number: undefined, finality_status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.withdrawal("0x1", "0xabc"))).rejects.toThrow();
});
it("refuses old receipt layouts rather than applying the new interpretation", async () => {
  const old = receipt();
  old.events[0]!.data = ["3", "7", "8", "9", "3", "0x123", "5", "17"];
  rpc.events.mockResolvedValue({
    events: old.events.map((event) => ({ ...event, transaction_hash: "0xabc", block_number: 10, block_hash: "0xa" })),
  });
  expect(await Effect.runPromise(fixture().ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [],
    held: [{ reason: "decode withdrawal receipt" }],
  });
});

it("reads an accepted hash anchor without loading the ABI or resolving a receipt binding", async () => {
  const f = fixture();
  expect(await Effect.runPromise(f.ports.blockHash(10))).toBe("0xa");
  expect(rpc.contract).not.toHaveBeenCalled();
  expect(f.bindings.frontierSeason).not.toHaveBeenCalled();
  rpc.header.mockResolvedValue({ ...header, status: "PRE_CONFIRMED" });
  await expect(Effect.runPromise(f.ports.blockHash(10))).rejects.toThrow();
});

it("reads confirmed rows when the public proxy refuses block-with-receipts", async () => {
  rpc.block.mockRejectedValue({ code: -32601, message: "Method not public" });
  rpc.events.mockResolvedValue({ events: [emitted()] });
  const rows = await fixture().reader.page(10, 10, null);
  expect(rows.rows[0]).toMatchObject({ model: "LordsWithdrawal", transactionHash: "0xabc" });
  expect(rpc.block).not.toHaveBeenCalled();
  expect(rpc.hashes).not.toHaveBeenCalled();
  expect(rpc.receipt).not.toHaveBeenCalled();
  expect(rpc.events).toHaveBeenCalledWith(expect.objectContaining({ address, chunk_size: 100 }));
});

it("sets aside a bot receipt with no Realms id while still decoding the next player's receipt", async () => {
  const f = fixture();
  f.bindings.realmsIdForAccount.mockImplementation(async (account) => (account === "0x123" ? (null as never) : "0x2"));
  rpc.events.mockResolvedValue({
    events: ["0xabc", "0xdef"].map((hash) => {
      const row = emitted();
      row.transaction_hash = hash;
      row.data[2] = hash;
      row.data[4] = hash === "0xabc" ? "0x123" : "0x456";
      return row;
    }),
  });
  expect(await Effect.runPromise(f.ports.eventsPage(10, 10, null))).toMatchObject({
    withdrawals: [{ transactionHash: "0xdef" }],
    held: [{ kind: "receipt", reason: "withdrawal_account_unknown", receipt: { transactionHash: "0xabc" } }],
  });
});

it("pins one bounded Games event page without reading 2000 unrelated transaction receipts", async () => {
  rpc.hashes.mockResolvedValue({ ...header, transactions: Array(2000).fill("0xabc") });
  rpc.events.mockResolvedValue({ events: [emitted()], continuation_token: "more" });
  const page = await fixture().reader.page(10, 10, null);
  expect(JSON.parse(page.next!)).toEqual({ filter: 0, token: "more" });
  expect(rpc.events).toHaveBeenCalledTimes(1);
  expect(rpc.receipt).not.toHaveBeenCalled();
  expect(rpc.hashes).not.toHaveBeenCalled();
});

it("keeps every header in a bounded event range, including blocks with no value rows", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  rpc.header.mockImplementation(async (number: number) => ({
    ...header,
    block_number: number,
    block_hash: `0x${number + 1}`,
    parent_hash: `0x${number}`,
  }));
  const page = await Effect.runPromise(fixture().ports.eventsPage(10, 14, null));
  expect(page.anchors).toEqual([10, 11, 12, 13, 14].map((number) => ({ number, hash: `0x${number + 1}` })));
  expect(page.withdrawals).toEqual([]);
});
it("refuses a mixed-fork header range before persisting any receipts", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  rpc.header.mockImplementation(async (number: number) => ({
    ...header,
    block_number: number,
    block_hash: `0x${number + 1}`,
    parent_hash: number === 12 ? "0xff" : `0x${number}`,
  }));
  await expect(Effect.runPromise(fixture().ports.eventsPage(10, 14, null))).rejects.toMatchObject({
    operation: "confirmed_block_changed:11",
  });
});

it("filters only value models and resumes every deployed RowSet depth without gameplay traffic", async () => {
  const nested = JSON.parse(JSON.stringify(abi));
  nested[0].variants.push({ name: "Nested", type: "fixture::Nested", kind: "nested" });
  nested.push({
    type: "event",
    name: "fixture::Nested",
    kind: "enum",
    variants: [{ name: "RowSet", type: "fixture::RowSet", kind: "nested" }],
  });
  rpc.contract.mockResolvedValue({ abi: nested });
  rpc.events
    .mockResolvedValueOnce({ events: [emitted()], continuation_token: "more" })
    .mockResolvedValue({ events: [] });
  const reader = fixture().reader;
  const first = await reader.page(10, 10, null);
  const second = await reader.page(10, 10, first.next);
  const third = await reader.page(10, 10, second.next);
  expect(first.rows).toHaveLength(1);
  expect(third.next).toBeNull();
  expect(rpc.events).toHaveBeenCalledTimes(3);
  const calls = rpc.events.mock.calls.map(([query]) => query);
  expect(calls[1].continuation_token).toBe("more");
  expect(calls[2].continuation_token).toBeUndefined();
  for (const query of calls) {
    expect(query.keys.slice(-2)).toEqual([
      ["0x1"],
      ["LordsWithdrawal", "BlitzResult"].map(shortString.encodeShortString),
    ]);
  }
  expect(calls.map((query) => query.keys.length)).toEqual([3, 3, 4]);
});

it("does not fetch the full class again when the next alarm creates another reader", async () => {
  for (let alarm = 0; alarm < 3; alarm++) await fixture().reader.page(10, 10, null);
  expect(rpc.classHash).toHaveBeenCalledTimes(3);
  expect(rpc.contract).toHaveBeenCalledOnce();
  rpc.classHash.mockResolvedValue("0xfff");
  await fixture().reader.page(10, 10, null);
  expect(rpc.contract).toHaveBeenCalledTimes(2);
});

// Game 10 of dev chain DEV_18dfa7f2b475f083, as its shard emitted it at block 75,043: the prizes logic runs by library
// call from the Games contract and emits under BlitzEvent, a path the Games class itself does not declare.
const DEV_CHAIN = "0x4445565f31386466613766326234373566303833";
const GAME_TEN_WALLET = "0x269cb810bc22316f8e6a53d164398e83f8255f7e980621f6083e5f7bad74fa0";
const GAME_TEN_COMMITMENT = "0x3712465ef7b04dd2fbf16ed51b0fd17c6f2c88a3f5e1b2887eeabf07cb353fd";
const gameTenResult = {
  from_address: address,
  keys: [
    hash.getSelectorFromName("BlitzEvent"),
    hash.getSelectorFromName("RowSet"),
    "0x1",
    shortString.encodeShortString("BlitzResult"),
  ],
  data: ["0x1", "0xa", "0x5", "0x1", GAME_TEN_WALLET, "0x1", "0x1", GAME_TEN_COMMITMENT],
  transaction_hash: "0xbeef",
  block_number: 10,
  block_hash: "0xa",
};
const PRIZES_LOGIC = "0x77";
const prizesLogicAbi = () => [
  {
    type: "event",
    name: "prizes::Event",
    kind: "enum",
    variants: [{ name: "BlitzEvent", type: "prizes::BlitzResultState::Event", kind: "nested" }],
  },
  {
    type: "event",
    name: "prizes::BlitzResultState::Event",
    kind: "enum",
    variants: [{ name: "RowSet", type: "fixture::RowSet", kind: "nested" }],
  },
  (abi as { name: string }[]).find((item) => item.name === "fixture::RowSet")!,
];

/**
 * A shard whose Games class is `gamesClass` and whose one release answers `release`, holding game 10's result. The node
 * returns an event only when every key position the filter names matches it.
 */
const shardWithGameTen = (gamesClass: unknown[], release: string[]) => {
  rpc.chain.mockResolvedValue(DEV_CHAIN);
  rpc.contract.mockImplementation(async (classHash: string) => ({
    abi: BigInt(classHash) === BigInt(PRIZES_LOGIC) ? prizesLogicAbi() : gamesClass,
  }));
  rpc.call.mockImplementation(async ({ entrypoint }: { entrypoint: string }) =>
    entrypoint === "current_release" ? ["0x1"] : release,
  );
  rpc.events.mockImplementation(async ({ keys }: { keys: string[][] }) => ({
    events: keys.every(
      (allowed, index) =>
        !allowed.length || allowed.some((key) => BigInt(key) === BigInt(gameTenResult.keys[index] ?? "0x-1")),
    )
      ? [gameTenResult]
      : [],
  }));
};

/** Every Blitz result the relay reads from block 10, through each event filter. */
const resultsAtBlockTen = async (firstRelease = 1) => {
  const reader = new ShardReader({
    chainId: DEV_CHAIN,
    rpcUrl: "https://shard.test/rpc",
    gamesAddress: address,
    firstRelease,
  });
  const ports = shardWithdrawalPorts(reader, fixture().bindings);
  const results = [];
  let cursor: string | null = null;
  do {
    const page: { results: readonly unknown[]; next?: string | null } = await Effect.runPromise(
      ports.eventsPage(10, 10, cursor),
    );
    results.push(...page.results);
    cursor = page.next ?? null;
  } while (cursor);
  return results;
};

const GAME_TEN = [
  {
    chainId: DEV_CHAIN,
    gameId: 10,
    rows: [{ wallet: GAME_TEN_WALLET, rank: 1 }],
    commitment: GAME_TEN_COMMITMENT,
    blockNumber: 10,
  },
];

it("reads a Blitz result that a release's logic class emits under its own event enum", async () => {
  // The Games class: its events, and the committed release entrypoints and types its Release layout is read from.
  shardWithGameTen([...abi, ...gamesAbi], [...Array(17).fill(PRIZES_LOGIC), "0x0"]);
  expect(await resultsAtBlockTen()).toEqual(GAME_TEN);
});

it("reads a release laid out with one more logic class than today, from the Games ABI alone", async () => {
  // A release that splits an eighteenth logic class off: its LogicClasses struct gains a member, and `release` answers
  // nineteen felts. The prizes logic is the new class; the other seventeen are the old ones.
  const games = JSON.parse(JSON.stringify(gamesAbi)) as { type: string; name: string; members?: unknown[] }[];
  games
    .find((item) => item.type === "struct" && item.name === "games_storage::release::LogicClasses")!
    .members!.push({ name: "season_rules", type: "core::starknet::class_hash::ClassHash" });
  shardWithGameTen([...abi, ...games], [...Array(17).fill("0x66"), PRIZES_LOGIC, "0x0"]);
  expect(await resultsAtBlockTen()).toEqual(GAME_TEN);
});

it("reads a fresh chain from the release it began at, never asking for releases it does not hold", async () => {
  // A chain deployed at release 5 holds release 5 alone: its Games contract reverts "unknown release" below it.
  shardWithGameTen([...abi, ...gamesAbi], []);
  const asked: string[] = [];
  rpc.call.mockImplementation(async ({ entrypoint, calldata }: { entrypoint: string; calldata: string[] }) => {
    if (entrypoint === "current_release") return ["0x5"];
    asked.push(calldata[0]!);
    if (BigInt(calldata[0]!) < 5n) throw new Error("unknown release");
    return [...Array(17).fill(PRIZES_LOGIC), "0x0"];
  });
  expect(await resultsAtBlockTen(5)).toEqual(GAME_TEN);
  expect(new Set(asked)).toEqual(new Set(["5"]));
});

it("refuses a chain whose current release is older than the first its manifest names", async () => {
  shardWithGameTen([...abi, ...gamesAbi], [...Array(17).fill(PRIZES_LOGIC), "0x0"]);
  const reader = new ShardReader({
    chainId: DEV_CHAIN,
    rpcUrl: "https://shard.test/rpc",
    gamesAddress: address,
    firstRelease: 6,
  });
  await expect(reader.page(10, 10, null)).rejects.toThrow("shard_release_before_manifest");
});

it("connects to a registered shard from the first release its manifest maps", () => {
  const manifest = { rpcUrl: "https://shard.test/rpc", chainId: DEV_CHAIN, contracts: { games: address } };
  expect(shardConnection({ ...manifest, releaseSchemas: { "5": "0xs" } })).toEqual({
    rpcUrl: "https://shard.test/rpc",
    chainId: DEV_CHAIN,
    gamesAddress: address,
    firstRelease: 5,
  });
  expect(
    shardConnection({ ...manifest, releaseSchemas: { "3": "0xs", "1": "0xs", "4": "0xs", "2": "0xs" } }).firstRelease,
  ).toBe(1);
  expect(() => shardConnection({ ...manifest, releaseSchemas: {} })).toThrow("invalid_shard_manifest_releases");
  expect(() => shardConnection({ ...manifest } as unknown as Parameters<typeof shardConnection>[0])).toThrow(
    "invalid_shard_manifest_releases",
  );
  expect(() => shardConnection({ ...manifest, releaseSchemas: { latest: "0xs" } })).toThrow(
    "invalid_shard_manifest_releases",
  );
});

it("reads a shard's first release from the manifest its Herald serves, for that chain only", async () => {
  const herald = (status: number, body: unknown) => (async () => Response.json(body, { status })) as typeof fetch;
  const manifest = { chainId: DEV_CHAIN, releaseSchemas: { "6": "0xs", "5": "0xs" } };
  expect(await readFirstRelease("https://herald.test", DEV_CHAIN, herald(200, manifest))).toBe(5);
  await expect(readFirstRelease("https://herald.test", "0x1", herald(200, manifest))).rejects.toThrow(
    "herald_manifest_chain_differs",
  );
  await expect(readFirstRelease("https://herald.test", DEV_CHAIN, herald(503, {}))).rejects.toThrow(
    "herald_manifest_unavailable",
  );
});

it("pays a withdrawal the relics logic emits under its own event enum, read from its transaction receipt", async () => {
  // The relics logic runs by library call and writes LordsWithdrawal rows under RelicEvent, as the committed schema
  // lists ([RelicEvent, RowSet]); the Games class itself declares only the direct RowSet path the base fixture uses.
  const RELICS_LOGIC = "0x88";
  const debit = event();
  const relicDebit = { ...debit, keys: [hash.getSelectorFromName("RelicEvent"), ...debit.keys] };
  rpc.receipt.mockResolvedValue({ ...receipt(), events: [relicDebit] });
  rpc.contract.mockImplementation(async (classHash: string) => ({
    abi:
      BigInt(classHash) === BigInt(RELICS_LOGIC)
        ? [
            {
              type: "event",
              name: "relics::Event",
              kind: "enum",
              variants: [{ name: "RelicEvent", type: "relics::RelicState::Event", kind: "nested" }],
            },
            {
              type: "event",
              name: "relics::RelicState::Event",
              kind: "enum",
              variants: [{ name: "RowSet", type: "fixture::RowSet", kind: "nested" }],
            },
            (abi as { name: string }[]).find((item) => item.name === "fixture::RowSet")!,
          ]
        : [...abi, ...gamesAbi],
  }));
  rpc.call.mockImplementation(async ({ entrypoint }: { entrypoint: string }) =>
    entrypoint === "current_release" ? ["0x1"] : [...Array(17).fill(RELICS_LOGIC), "0x0"],
  );
  const withdrawal = await Effect.runPromise(fixture().ports.withdrawal("0x1", "0xabc"));
  expect(withdrawal).toEqual({
    prizeRank: 0,
    prizeCount: 0,
    blockNumber: 10,
    chainId: "0x1",
    seasonId: 3,
    transactionHash: "0xabc",
    realmsId: "0x2",
    amount: "17000000000000000000",
    confirmedAt: 1000,
  });
});

it("reads a full page's headers in batches the shard RPC accepts, checking each against its parent", async () => {
  rpc.events.mockResolvedValue({ events: [] });
  rpc.header.mockImplementation(async (number: number) => ({
    ...header,
    block_number: number,
    block_hash: `0x${(number + 1).toString(16)}`,
    parent_hash: `0x${number.toString(16)}`,
  }));
  const from = 1_000;
  const page = await Effect.runPromise(fixture().ports.eventsPage(from, from + SHARD_PAGE_BLOCKS - 1, null));
  expect(page.anchors).toHaveLength(SHARD_PAGE_BLOCKS);
  // The 498 headers between the page's ends go in batches of at most 32, never one round trip each.
  const batches = rpc.batch.mock.calls.map(([, method, size]) => [method, size]);
  expect(batches.every(([method, size]) => method === "starknet_getBlockWithTxHashes" && size <= 32)).toBe(true);
  expect(batches.reduce((total, [, size]) => total + (size as number), 0)).toBe(SHARD_PAGE_BLOCKS - 2);
  expect(batches).toHaveLength(Math.ceil((SHARD_PAGE_BLOCKS - 2) / 32));
});

it.each([false, true])(
  "pauses a forged report through the real reader even with an unknown account (leading honest report=%s)",
  async (leading) => {
    const { runMonitor } = await import("./monitor");
    const f = fixture();
    f.bindings.realmsIdForAccount.mockResolvedValue(null!);
    rpc.receipt.mockImplementation(async (transactionHash: string) => ({
      ...receipt(),
      transaction_hash: transactionHash,
      events: [{ from_address: address, ...withdrawalEvent(7, transactionHash, "0x123", 17) }],
    }));
    const report = (transactionHash: string, amount: bigint) => ({
      chainId: "0x1",
      seasonId: 3,
      transactionHash,
      amount: String(amount * 10n ** 18n),
      prizeRank: 0,
      prizeCount: 0,
      wallet: "0x0",
      reportTransactionHash: "0x999",
    });
    const page = { next: null, head: 10, anchor: { number: 10, hash: "0xa" }, rewind: false, fromBlock: 1 };
    let progress: import("./monitor").MonitorProgress = { halted: null };
    const pause = vi.fn(() => Effect.void),
      approvePayment = vi.fn(() => Effect.void);
    const ports: import("./ports").MonitorPorts = {
      identity: { matchesPayDecision: () => Effect.succeed(false) },
      shard: {
        ...f.ports,
        conservation: () => Effect.succeed([]),
        result: () => Effect.succeed(null),
        settlementEvidence: () => Effect.succeed(null),
      },
      ledger: {
        pause,
        approvePayment,
        approveSettlement: () => Effect.void,
        frontierPool: () => Effect.succeed("0"),
        reportedClaims: () =>
          Effect.succeed({ ...page, rows: [...(leading ? [report("0xabc", 17n)] : []), report("0xdef", 18n)] }),
        reportedSettlements: () => Effect.succeed({ ...page, rows: [] }),
        paidClaims: () => Effect.succeed({ ...page, rows: [] }),
        postedResults: () => Effect.succeed({ ...page, rows: [] }),
      },
    };
    const store = {
      load: async () => progress,
      save: async (next: typeof progress) => {
        progress = next;
      },
    };
    await Effect.runPromise(runMonitor(ports, store));
    expect(progress.halted).toBe("reported_claim_mismatch:0xdef");
    expect(pause).toHaveBeenCalledOnce();
    expect(f.bindings.realmsIdForAccount).not.toHaveBeenCalled();
    expect(approvePayment).not.toHaveBeenCalled();
    for (let tick = 0; tick < 61; tick++) await Effect.runPromise(runMonitor(ports, store));
    expect(pause).toHaveBeenCalledTimes(62);
  },
);
