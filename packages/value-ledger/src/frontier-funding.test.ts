import { beforeEach, expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readFrontierFunding } from "./frontier-funding";
import { ledgerAbi } from "../test-support/ledger-abi";
import { response } from "../test-support/abi";

const terms = { chestPoolBps: 7000, topN: 10, start: 10, end: 110, seed: "0x99", dayUnit: 5, claimWindow: 604800 };
const call = vi.fn();
let closed = false;
let end = 110;
const provider = {
  getBlock: async () => ({ block_number: 12, block_hash: "0xaa", status: "ACCEPTED_ON_L2", timestamp: 50 }),
  callContract: call,
} as unknown as RpcProvider;
const read = (native = terms) => readFrontierFunding(provider, "0x10", { chainId: "0x1", gameId: 7 }, native);
beforeEach(() => {
  closed = false;
  end = 110;
  call.mockReset();
  call.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "get_frontier"
      ? response(ledgerAbi, entrypoint, {
          prize_pool: { low: 0, high: 0 },
          prize_paid: { low: 0, high: 0 },
          funded: true,
          start: 10,
          end,
          pool: { low: 100n * 10n ** 18n, high: 0 },
          paid: { low: 0, high: 0 },
          closed,
          preset_id: 2,
          seed: 153,
        })
      : response(ledgerAbi, "get_preset", {
          frontier_top_n: 10,
          frontier_chest_bps: 7000,
          entry_fee: { low: 0, high: 0 },
          protocol_cut_bps: 0,
          chest_lords_bps: 0,
          paid_fraction_bps: 0,
          decay_bps: 0,
          sword_price: { low: 0, high: 0 },
          shield_price: { low: 0, high: 0 },
          mmr: { enabled: false, mean: 0, spread: 0, max_delta: 0, k: 0, regression_bps: 0 },
          day_unit_seconds: 5,
          claim_window_seconds: 604800,
        }),
  );
});
it("binds the funded pool and every native clock rule at one confirmed ledger head", async () => {
  expect(await read()).toMatchObject({ claimDeadline: 604910, confirmedBlock: 12 });
  expect(call.mock.calls.map(([query, head]) => [query.entrypoint, head])).toEqual([
    ["get_frontier", 12],
    ["get_preset", 12],
  ]);
});
it.each([{ start: 11 }, { end: 210 }, { seed: "0x98" }, { dayUnit: 10 }, { claimWindow: 604801 }])(
  "refuses different native terms %j",
  async (change) => {
    await expect(read({ ...terms, ...change })).rejects.toThrow("frontier_funding_differs_from_game");
  },
);
it("refuses an unfunded season and unavailable reads instead of assuming funding", async () => {
  call.mockRejectedValueOnce({ code: 40, data: { revert_error: "Ledger: unknown Frontier season" } });
  await expect(read()).rejects.toThrow("frontier_funding_missing");
  call.mockRejectedValueOnce(new Error("RPC unavailable"));
  await expect(read()).rejects.toThrow("RPC unavailable");
});
it("binds historical claims after their funded pool closes", async () => {
  closed = true;
  expect(await read()).toMatchObject({ closed: true, claimDeadline: 604910 });
});
it.each([1, 2, 21, 30])("binds %i whole bags from the game without a preset duration", async (bags) => {
  end = terms.start + bags * 20 * terms.dayUnit;
  expect(await read({ ...terms, end })).toMatchObject({ end, claimDeadline: end + terms.claimWindow });
});
it("refuses partial bags even if the ledger and game agree", async () => {
  end = 111;
  await expect(read({ ...terms, end })).rejects.toThrow("frontier_funding_differs_from_game");
});

it("returns the ledger deposit independently of any preset funding amount", async () => {
  expect((await read()).pool).toBe(String(100n * 10n ** 18n));
});

it("keeps the caller's effect-read block when the provider head has advanced", async () => {
  expect(await readFrontierFunding(provider, "0x10", { chainId: "0x1", gameId: 7 }, terms, 11)).toMatchObject({
    confirmedBlock: 11,
  });
  expect(call.mock.calls.map(([query, head]) => [query.entrypoint, head])).toEqual([
    ["get_frontier", 11],
    ["get_preset", 11],
  ]);
});
