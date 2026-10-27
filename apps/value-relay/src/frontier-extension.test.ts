import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CallData, shortString } from "starknet";
import approved from "../../../config/source/frontier/extension.json";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { readFrontierExtension, requireExtendedFrontier } from "./frontier-extension";

const rpc = vi.hoisted(() => ({ call: vi.fn(), ledger: vi.fn(), now: 0, l2chain: "0x0", l2status: "ACCEPTED_ON_L2" }));
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
  rpcAt: (url: string) => ({
    getChainId: async () => (url.includes("ledger") ? rpc.l2chain : approved.chainId),
    getBlock: async (height: number | string) => ({
      status: url.includes("ledger") ? rpc.l2status : "ACCEPTED_ON_L2",
      block_number: typeof height === "number" ? height : 100,
      block_hash: "0xa",
      parent_hash: "0x9",
      timestamp: rpc.now,
    }),
    getClassHashAt: async () => "0xe491",
    getClassByHash: async () => ({ abi: gamesAbi }),
    callContract: url.includes("ledger") ? rpc.ledger : rpc.call,
  }),
}));
const target = { rpcUrl: "https://shard.test", gamesAddress: "0x10", chainId: approved.chainId };
let game: Record<string, unknown>;
let projected: Record<string, unknown>;
let ledgerEnd: number;
let ledgerSeed: string;
let ledgerPool: bigint;
let release: number;
let closed: boolean;
let preconfirmed: number | undefined;
const run = () => readFrontierExtension(target, "https://herald.test", "https://ledger.test");
const encode = (value: unknown) => CallData.compile(value as Parameters<typeof CallData.compile>[0]);

beforeEach(() => {
  vi.clearAllMocks();
  rpc.now = approved.oldEnd - 3600;
  rpc.l2chain = shortString.encodeShortString("SN_MAIN");
  rpc.l2status = "ACCEPTED_ON_L2";
  game = {
    name: shortString.encodeShortString(approved.name),
    preset_id: approved.presetId,
    settled: false,
    ready: true,
    dev_mode_on: false,
    start_settling_at: approved.start,
    start_main_at: approved.start,
    end_at: approved.end,
    end_grace_seconds: 0,
    seed: approved.seed,
  };
  projected = { ...game, game_id: 1 };
  ledgerEnd = approved.end;
  ledgerSeed = approved.seed;
  release = approved.release;
  closed = false;
  ledgerPool = BigInt(approved.poolLords) * 10n ** 18n;
  preconfirmed = undefined;
  rpc.call.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "game") return encode(game);
    throw new Error(`unexpected ${entrypoint}`);
  });
  rpc.ledger.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "get_frontier")
      return encode([
        true,
        approved.start,
        ledgerEnd,
        { low: ledgerPool, high: 0 },
        { low: 91n * 10n ** 18n, high: 0 },
        closed,
        approved.presetId,
        ledgerSeed,
        { low: 0, high: 0 },
        { low: 0, high: 0 },
      ]);
    if (entrypoint === "get_preset")
      return [
        0,
        0,
        0,
        9000,
        2000,
        9600,
        0,
        0,
        0,
        0,
        0,
        1500,
        450,
        45,
        50,
        150,
        approved.dayUnit,
        approved.claimWindow,
        10000,
        0,
      ].map(String);
    throw new Error(`unexpected ${entrypoint}`);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        game_id: "1",
        confirmed_block: 90,
        preconfirmed_block: preconfirmed,
        models: Object.entries({
          GameRegistry: projected,
          GameRelease: { game_id: 1, release_id: release },
          LordsBudget: { game_id: 1, pool: approved.poolLords },
          ChestRules: { game_id: 1, claim_window_seconds: approved.claimWindow },
          SliceRules: { game_id: 1, day_unit_seconds: approved.dayUnit },
        }).map(([model, value]) => ({ model, rows: [{ key: "1", value }] })),
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("confirms both clocks and funding at explicit confirmed heads", async () => {
  const proof = requireExtendedFrontier(await run());
  expect(proof).toMatchObject({
    worldEnd: approved.end,
    ledgerEnd: approved.end,
    worldBlock: 90,
    ledgerBlock: 100,
    release: 4,
    pool: String(ledgerPool),
    paid: String(91n * 10n ** 18n),
  });
  expect(rpc.call).toHaveBeenCalledWith(expect.objectContaining({ entrypoint: "game" }), 90);
  expect(rpc.ledger).toHaveBeenCalledWith(expect.objectContaining({ entrypoint: "get_frontier" }), 100);
});
it("refuses reconciliation during an interrupted cross-chain extension, then recovers on readback", async () => {
  ledgerEnd = approved.oldEnd;
  const pending = await run();
  expect(() => requireExtendedFrontier(pending)).toThrow("extension_not_confirmed_on_both_chains");
  ledgerEnd = approved.end;
  expect(requireExtendedFrontier(await run()).ledgerEnd).toBe(approved.end);
});
it.each(["projection", "seed", "pool", "closed", "release", "expired", "l2chain", "provisional"])(
  "refuses %s without a calendar write",
  async (kind) => {
    if (kind === "projection") projected.end_at = approved.oldEnd;
    if (kind === "seed") ledgerSeed = "0x1";
    if (kind === "pool") ledgerPool -= 1n;
    if (kind === "closed") closed = true;
    if (kind === "release") release = 3;
    if (kind === "expired") rpc.now = approved.end;
    if (kind === "l2chain") rpc.l2chain = "0x1";
    if (kind === "provisional") preconfirmed = 101;
    await expect(run()).rejects.toThrow();
  },
);
