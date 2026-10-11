import { beforeEach, expect, it, vi } from "vitest";
import type { RpcProvider } from "starknet";
import { readFrontierFunding } from "./frontier-funding";
import { ledgerAbi } from "../test-support/ledger-abi";
import { response } from "../test-support/abi";

const terms = { start: 10, end: 110, seed: "0x99", dayUnit: 5, claimWindow: 604800 };
const call = vi.fn();
let closed = false;
let bags = 1;
const provider = {
  getBlock: async () => ({ block_number: 12, block_hash: "0xaa", status: "ACCEPTED_ON_L2", timestamp: 50 }),
  callContract: call,
} as unknown as RpcProvider;
const read = (native = terms) => readFrontierFunding(provider, "0x10", { chainId: "0x1", gameId: 7 }, native);
beforeEach(() => {
  closed = false;
  bags = 1;
  call.mockReset();
  call.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "get_frontier"
      ? response(ledgerAbi, entrypoint, {
          funded: true,
          start: 10,
          end: 110,
          pool: { low: 100n * 10n ** 18n, high: 0 },
          paid: { low: 0, high: 0 },
          closed,
          preset_id: 2,
          seed: 153,
        })
      : response(ledgerAbi, "get_preset", {
          entry_fee: { low: 0, high: 0 },
          protocol_cut_bps: 0,
          chest_lords_bps: 0,
          paid_fraction_bps: 0,
          decay_bps: 0,
          sword_price: { low: 0, high: 0 },
          shield_price: { low: 0, high: 0 },
          mmr: { enabled: false, mean: 0, spread: 0, max_delta: 0, k: 0, regression_bps: 0 },
          day_unit_seconds: 5,
          season_bags: bags,
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
it.each([{ start: 11 }, { end: 111 }, { seed: "0x98" }, { dayUnit: 10 }, { claimWindow: 604801 }])(
  "refuses different native terms %j",
  async (change) => {
    await expect(read({ ...terms, ...change })).rejects.toThrow("frontier_funding_differs_from_game");
  },
);
it("refuses an unfunded season and unavailable reads instead of assuming funding", async () => {
  call.mockRejectedValueOnce(new Error("Ledger: unknown Frontier season"));
  await expect(read()).rejects.toThrow("unknown Frontier season");
  call.mockRejectedValueOnce(new Error("RPC unavailable"));
  await expect(read()).rejects.toThrow("RPC unavailable");
});
it("binds historical claims after their funded pool closes", async () => {
  closed = true;
  expect(await read()).toMatchObject({ closed: true, claimDeadline: 604910 });
});
it("refuses a different ledger bag count", async () => {
  bags = 2;
  await expect(read()).rejects.toThrow("frontier_funding_differs_from_game");
});

it("returns the ledger deposit independently of any preset funding amount", async () => {
  expect((await read()).pool).toBe(String(100n * 10n ** 18n));
});
