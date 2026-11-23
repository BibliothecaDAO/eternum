import { beforeEach, expect, it, vi } from "vitest";
import { readFinishedRace } from "./race-facts";

const header = vi.hoisted(() => vi.fn());
vi.mock("./shard-rpc", async (original) => ({
  ...(await original<typeof import("./shard-rpc")>()),
  ShardReader: class {
    header = header;
  },
}));

const connection = { chainId: "0x2", rpcUrl: "http://127.0.0.1:8080", gamesAddress: "0x20", firstRelease: 1 };
const LORDS = 10n ** 18n;
const GLORY = 10n ** 9n;
const rows = (model: string, values: Record<string, unknown>[]) => ({
  model,
  rows: values.map((value) => ({ key: "", value: { game_id: 7, ...value } })),
});
const finished = (overrides: Record<string, Record<string, unknown>[]> = {}) => {
  const models: Record<string, Record<string, unknown>[]> = {
    RaceResult: [{ winner: 2, ended_at: "900", scheduled_end_at: "5000" }],
    AspectHyperstructure: [
      { aspect: 1, height: 100 },
      { aspect: 2, height: 10000 },
      { aspect: 3, height: 0 },
      { aspect: 4, height: 0 },
    ],
    HomeAspect: [
      { home: "5", aspect: 1 },
      { home: "9", aspect: 2 },
      { home: "11", aspect: 2 },
      { home: "12", aspect: 3 },
    ],
    RaceMember: [
      { entity_id: "5", glory: String(100n * GLORY), contribution: "0" },
      { entity_id: "9", glory: String(300n * GLORY), contribution: "0" },
      { entity_id: "11", glory: String(99n * GLORY), contribution: "0" },
    ],
    Structure: [
      { entity_id: "5", owner: "0x0456" },
      { entity_id: "9", owner: "0x789" },
      { entity_id: "11", owner: "0xabc" },
      { entity_id: "12", owner: "0xdef" },
      { entity_id: "40", owner: "0x0" },
    ],
    ...overrides,
  };
  return {
    confirmed_block: 10,
    game_id: "7",
    models: Object.entries(models).map(([name, values]) => rows(name, values)),
  };
};
const network = vi.fn<typeof fetch>();
const read = () => readFinishedRace(connection, "http://127.0.0.1:8081", 7, network);
beforeEach(() => {
  vi.resetAllMocks();
  header.mockResolvedValue({ block_number: 10, timestamp: 900 });
  network.mockImplementation(async () => Response.json(finished()));
});

it("reads what a finished race owes each home and the account that owns it", async () => {
  expect(await read()).toEqual({
    total: 201_000n * LORDS,
    rewards: [
      { home: 5n, aspect: 1, amount: 1000n * LORDS, owner: "0x456" },
      { home: 9n, aspect: 2, amount: 200_000n * LORDS, owner: "0x789" },
    ],
  });
  expect(String(network.mock.calls[0]![0])).toBe(
    "http://127.0.0.1:8081/games/7/snapshot?models=RaceResult,AspectHyperstructure,HomeAspect,RaceMember,Structure",
  );
  expect(header).toHaveBeenCalledWith(10);
});
it("owes nothing to read while the race has no result or the snapshot is older than its end", async () => {
  network.mockImplementation(async () => Response.json(finished({ RaceResult: [] })));
  expect(await read()).toBeNull();
  network.mockImplementation(async () => Response.json(finished()));
  header.mockResolvedValue({ block_number: 10, timestamp: 899 });
  expect(await read()).toBeNull();
});
it("pays no first-finish share when the season ends with no Aspect finished", async () => {
  network.mockImplementation(async () =>
    Response.json(finished({ RaceResult: [{ winner: null, ended_at: "900", scheduled_end_at: "900" }] })),
  );
  expect((await read())!.total).toBe(101_000n * LORDS);
});
it.each([
  ["a rewarded home without an owner", { Structure: [{ entity_id: "5", owner: "0x456" }] }, "race_home_unowned"],
  ["a missing Aspect height", { AspectHyperstructure: [{ aspect: 1, height: 100 }] }, "race_heights_incomplete"],
  ["a home in an unknown Aspect", { HomeAspect: [{ home: "5", aspect: 0 }] }, "race_member_invalid"],
  [
    "an unsafe Glory value",
    { RaceMember: [{ entity_id: "5", glory: 1e30, contribution: "0" }] },
    "unsafe_snapshot_integer",
  ],
])("refuses %s", async (_, overrides, message) => {
  network.mockImplementation(async () => Response.json(finished(overrides)));
  await expect(read()).rejects.toThrow(message);
});
it("reads nothing from an unavailable Herald", async () => {
  network.mockResolvedValue(new Response(null, { status: 503 }));
  await expect(read()).rejects.toThrow("confirmed_herald_read_unavailable");
});
