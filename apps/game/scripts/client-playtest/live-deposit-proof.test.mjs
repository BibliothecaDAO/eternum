import { afterEach, describe, expect, it, vi } from "vitest";
import { byteArray, hash, transaction } from "starknet";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json" with { type: "json" };
import { createRunOwner } from "./run-owner.mjs";
import {
  assertMixedRefill,
  assertOnlyRefillAction,
  assertRefillConservation,
  assertRefillTransaction,
  assertSuccessfulReceipt,
  assertVisiblePurse,
  liveDepositReads,
  newActionHashes,
  pollProof,
  visibleStaminaMatches,
  watchDepositResponses,
} from "./live-deposit-proof.mjs";

afterEach(() => vi.unstubAllGlobals());

const destination = {
  chainId: "0x5331",
  gameId: 7,
  actor: "0x123",
  worldAddress: "0x77",
  rpcUrl: "https://rpc.test",
  url: "https://herald.test",
};
const release = { release_id: 2, preset_commitment: 3n };
const receipt = {
  transaction_hash: "0xabc",
  block_number: 9,
  block_hash: "0x99",
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
  events: [],
};

function states() {
  const before = {
    purchased: { available: 10n, consumed: 5n, swept: 2n },
    earned: 30n,
    budget: { pool_left: 100n, pool: 200n, open: 50n, day: 0n },
    withdrawals: [],
    maximum: 100,
    troops: {
      category: TroopType.Knight,
      tier: TroopTier.T1,
      staminaMax: 100,
      stamina: { amount: 20n, settled_at: 100, remainder: 0 },
      boosts: { incr_stamina_regen_seconds_left: 0, incr_stamina_regen_percent_num: 0 },
    },
    rules: { stamina_gain_per_tick: 2, stamina_initial: 0, stamina_knight_max: 100 },
    tickSeconds: 10,
  };
  const after = structuredClone(before);
  after.purchased.available = 0n;
  after.purchased.consumed = 15n;
  after.earned = 25n;
  after.budget.pool_left = 105n;
  after.troops.stamina = { amount: 37n, settled_at: 110, remainder: 0 };
  return { before, after };
}

describe("live mixed refill evidence", () => {
  it("accepts exact purchased-first spending and independently regenerated native stamina", () => {
    const { before, after } = states();
    expect(assertRefillConservation(before, after, "15", 110)).toMatchObject({
      amount: "15",
      purchasedDebit: "10",
      earnedDebit: "5",
      receiptTimestamp: 110,
      after: { troops: { stamina: { amount: "37", settled_at: 110 } } },
    });
    expect(visibleStaminaMatches({ current: "37", maximum: "100" }, after, 110, 111)).toBe(true);
    expect(visibleStaminaMatches({ current: "39", maximum: "100" }, after, 110, 120)).toBe(true);
    expect(visibleStaminaMatches({ current: "40", maximum: "100" }, after, 110, 120)).toBe(false);
    expect(visibleStaminaMatches({ current: "37", maximum: "37" }, after, 110, 120)).toBe(false);
    expect(visibleStaminaMatches(null, after, 110, 120)).toBe(false);
  });

  it.each([
    ["purchased", "available", 1n],
    ["purchased", "consumed", 14n],
    ["purchased", "swept", 3n],
    ["budget", "pool_left", 115n],
    ["budget", "pool", 201n],
    ["budget", "open", 51n],
    ["budget", "day", 1n],
  ])("refuses drift in %s.%s", (group, field, wrong) => {
    const { before, after } = states();
    after[group][field] = wrong;
    expect(() => assertRefillConservation(before, after, "15", 110)).toThrow();
  });

  it("rejects earned-first debit, new withdrawals, and stamina that ignores regeneration", () => {
    for (const change of [
      (after) => {
        after.earned = 15n;
      },
      (after) => {
        after.withdrawals = [{ amount: "1" }];
      },
      (after) => {
        after.troops.stamina.amount = 35n;
      },
      (after) => {
        after.troops.stamina.remainder = 1;
      },
    ]) {
      const { before, after } = states();
      change(after);
      expect(() => assertRefillConservation(before, after, "15", 110)).toThrow();
    }
  });

  it("compares raw decimal balances beyond Number precision and requires a mixed partial amount", () => {
    const state = { purchased: { available: 9007199254740993n }, earned: 2n };
    expect(() => assertVisiblePurse({ spend: "9007199254740993", earned: "2" }, state)).not.toThrow();
    expect(() => assertVisiblePurse({ spend: "9007199254740992", earned: "2" }, state)).toThrow();
    expect(() => assertVisiblePurse({ spend: null, earned: null }, state)).toThrow();
    expect(() => assertMixedRefill({ spend: "10", earned: "30" }, "15", "80")).not.toThrow();
    for (const [spend, earned, amount, missing] of [
      ["0", "30", "15", "80"],
      ["10", "30", "10", "80"],
      ["10", "0", "15", "80"],
      ["10", "30", "41", "80"],
      ["10", "30", "15", "15"],
      ["10", "30", null, "80"],
    ])
      expect(() => assertMixedRefill({ spend, earned }, amount, missing)).toThrow();
  });

  it("requires the actual invocation to match one generated refill of the selected game and army", () => {
    const command = encodeNativeCommand(bindings.commandAbi, {
      kind: "RefillStamina",
      value: { explorer_id: 201, amount: "15" },
    });
    const actual = {
      type: "INVOKE",
      sender_address: destination.actor,
      transaction_hash: receipt.transaction_hash,
      calldata: transaction.getExecuteCalldata(
        [
          {
            contractAddress: destination.worldAddress,
            entrypoint: "play",
            calldata: ["7", "2", "3", String(command.length), ...command],
          },
        ],
        "1",
      ),
    };
    expect(() => assertRefillTransaction(actual, receipt, destination, release, 201, "15")).not.toThrow();
    expect(() => assertRefillTransaction(actual, receipt, destination, release, 202, "15")).toThrow();
    expect(() => assertRefillTransaction(actual, receipt, destination, release, 201, "16")).toThrow();
    expect(() => assertRefillTransaction(actual, receipt, { ...destination, gameId: 8 }, release, 201, "15")).toThrow();
    expect(() =>
      assertRefillTransaction(
        { ...actual, calldata: [...actual.calldata, "0"] },
        receipt,
        destination,
        release,
        201,
        "15",
      ),
    ).toThrow();
  });

  it("refuses GameplayRejected even when Starknet execution succeeded", () => {
    expect(() => assertSuccessfulReceipt(receipt, destination, receipt.transaction_hash)).not.toThrow();
    const reason = byteArray.byteArrayFromString("invalid refill amount");
    const rejected = {
      ...receipt,
      events: [
        {
          from_address: destination.worldAddress,
          keys: [hash.getSelectorFromName("GameplayRejected"), "1", "7", destination.actor, receipt.transaction_hash],
          data: ["0", String(reason.data.length), ...reason.data, reason.pending_word, String(reason.pending_word_len)],
        },
      ],
    };
    expect(() => assertSuccessfulReceipt(rejected, destination, receipt.transaction_hash)).toThrow(
      "GameplayRejected: invalid refill amount",
    );
    expect(() =>
      assertSuccessfulReceipt({ ...receipt, finality_status: "PRE_CONFIRMED" }, destination, receipt.transaction_hash),
    ).toThrow("not confirmed");
    expect(() =>
      assertSuccessfulReceipt({ ...receipt, events: undefined }, destination, receipt.transaction_hash),
    ).toThrow("event evidence");
  });

  it("deduplicates normal action records by hash but exposes a second send", () => {
    const prior = [{ transactionHash: "0x01" }];
    expect(newActionHashes([...prior, { transactionHash: "0xabc" }, { transactionHash: "0x0abc" }], prior)).toEqual([
      "0xabc",
    ]);
    expect(newActionHashes([{ transactionHash: "0xabc" }, { transactionHash: "0xabd" }], prior)).toEqual([
      "0xabc",
      "0xabd",
    ]);
    expect(newActionHashes([], prior)).toEqual([]);
  });

  it("refuses an extra send even before that send has a hash", () => {
    const sent = { transactionHash: "0xabc", send: { key: "refill-1" } };
    expect(() => assertOnlyRefillAction([sent], [], "0xabc")).not.toThrow();
    expect(() => assertOnlyRefillAction([sent, { send: { key: "refill-2" } }], [], "0xabc")).toThrow();
    expect(() => assertOnlyRefillAction([], [], "0xabc")).toThrow();
  });

  it("waits for a snapshot covering the receipt block and retains every raw response body", async () => {
    const bodies = [
      { game_id: "7", confirmed_block: 8, models: [] },
      { game_id: "7", confirmed_block: 9, models: [] },
      { block_number: 9, timestamp: 110 },
    ];
    const wire = bodies.map((body, i) => JSON.stringify(i === 2 ? { result: body } : body));
    let index = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(wire[index++], { status: 200 })),
    );
    const evidence = { responses: [] };
    const owner = { ...createRunOwner(), sleep: async () => {} };
    const reads = liveDepositReads(owner, evidence, destination);
    try {
      expect(await reads.snapshot(9)).toEqual({ body: bodies[1], head: bodies[2] });
      expect(evidence.responses.map(({ body }) => body)).toEqual(wire);
    } finally {
      reads.stop();
    }
  });

  it.each(["0x5331", "0x5332"])("binds the RPC's chain %s to the selected chain", async (chainId) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ result: chainId })));
    vi.stubGlobal("fetch", fetch);
    const evidence = { responses: [] };
    const reads = liveDepositReads(createRunOwner(), evidence, destination);
    try {
      if (chainId === destination.chainId) await expect(reads.verifyChain()).resolves.toBe(chainId);
      else await expect(reads.verifyChain()).rejects.toThrow("RPC chain does not match the selected chain");
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ method: "starknet_chainId", params: [] });
      expect(evidence.responses[0].body).toBe(JSON.stringify({ result: chainId }));
    } finally {
      reads.stop();
    }
  });

  it.each(["0x99", "0x98"])(
    "checks the canonical block by number, including a replaced block (%s)",
    async (blockHash) => {
      const head = { block_number: 9, block_hash: blockHash, timestamp: 110, transactions: [receipt.transaction_hash] };
      const fetch = vi.fn(async () => new Response(JSON.stringify({ result: head })));
      vi.stubGlobal("fetch", fetch);
      const evidence = { responses: [] };
      const reads = liveDepositReads(createRunOwner(), evidence, destination);
      try {
        if (blockHash === receipt.block_hash) await expect(reads.receiptHead(receipt)).resolves.toEqual(head);
        else await expect(reads.receiptHead(receipt)).rejects.toThrow("not in its canonical confirmed block");
        expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
          method: "starknet_getBlockWithTxHashes",
          params: { block_id: { block_number: 9 } },
        });
        expect(evidence.responses[0].body).toBe(JSON.stringify({ result: head }));
      } finally {
        reads.stop();
      }
    },
  );

  it.each([10, null])(
    "refuses a snapshot carrying preconfirmed_block=%s before reading its head",
    async (preconfirmed) => {
      const body = JSON.stringify({ game_id: "7", confirmed_block: 9, preconfirmed_block: preconfirmed, models: [] });
      const fetch = vi.fn(async () => new Response(body));
      vi.stubGlobal("fetch", fetch);
      const evidence = { responses: [] };
      const reads = liveDepositReads(createRunOwner(), evidence, destination);
      try {
        await expect(reads.snapshot(9)).rejects.toThrow("Herald snapshot contains preconfirmed_block");
        expect(fetch).toHaveBeenCalledOnce();
        expect(evidence.responses[0].body).toBe(body);
      } finally {
        reads.stop();
      }
    },
  );

  it("retains HTTP failure bodies and never treats missing evidence as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"error":"unavailable"}', { status: 503 })),
    );
    const evidence = { responses: [] };
    const owner = createRunOwner();
    const reads = liveDepositReads(owner, evidence, destination);
    try {
      await expect(reads.snapshot()).rejects.toThrow("HTTP 503");
      expect(evidence.responses[0]).toMatchObject({ status: 503, body: '{"error":"unavailable"}' });
      owner.cancel("SIGINT");
      await expect(pollProof(owner, () => null, Boolean, 600_000, "missing")).rejects.toThrow("cancelled: SIGINT");
    } finally {
      reads.stop();
    }
  });
});

describe("the deposit's response record", () => {
  it("keeps the Realms wallet's build with its calls, and its execute without the passkey's signature", async () => {
    const listeners = [];
    const devTools = {
      onEvent: (listener) => (listeners.push(listener), () => listeners.splice(listeners.indexOf(listener), 1)),
      send: async (_, { requestId }) => ({ body: `answer ${requestId}`, base64Encoded: false }),
    };
    const evidence = { responses: [] };
    const stop = watchDepositResponses(devTools, evidence);
    const request = (requestId, url, postData) => {
      for (const listener of listeners)
        listener({ method: "Network.requestWillBeSent", params: { requestId, request: { url, postData } } });
      for (const listener of listeners) listener({ method: "Network.loadingFinished", params: { requestId } });
    };
    request("1", "https://identity.test/auth/wallet/default/build", '{"calls":[{"entrypoint":"deposit_lords"}]}');
    request("2", "https://identity.test/auth/wallet/default/execute", '{"typedData":{},"ownerSignature":["0x4"]}');
    request("3", "https://identity.test/auth/session", undefined);
    await stop();
    expect(evidence.responses).toEqual([
      {
        url: "https://identity.test/auth/wallet/default/build",
        method: "POST",
        request: '{"calls":[{"entrypoint":"deposit_lords"}]}',
        body: "answer 1",
      },
      { url: "https://identity.test/auth/wallet/default/execute", method: "POST", body: "answer 2" },
    ]);
  });
});
