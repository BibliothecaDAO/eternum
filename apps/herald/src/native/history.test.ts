import { beforeEach, expect, it, vi } from "vitest";
import { manifest, raw, schema, setup } from "./fixtures";
import { createNativeHistoryCodec } from "./history";

const db = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), release: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = db.query;
    connect = async () => ({ query: db.transaction, release: db.release });
  },
}));
import { HistoryStore } from "../history-store";

beforeEach(() => {
  db.query.mockReset().mockResolvedValue({ rows: [] });
  db.transaction.mockReset().mockResolvedValue({ rows: [] });
  db.release.mockReset();
});

it("retains one distinct history story per troop and economy action", async () => {
  const cases: [string, string, string[]][] = [
    ["troops", "ExplorerCreateStory", ["7", "3", "0", "0", "1000000000", "2"]],
    ["troops", "ExplorerAddStory", ["7", "2000000000"]],
    ["troops", "GuardAddStory", ["3", "0", "0", "0", "1000000000"]],
    ["troops", "TroopsTransferred", ["0", "7", "1", "3", "0", "1000000000"]],
    ["troops", "GuardDeleteStory", ["3", "0"]],
    ["troops", "ExplorerDeleteStory", ["7"]],
    ["economy", "TradeCancelled", ["9"]],
    ["economy", "BankLiquidity", ["10", "3", "2", "100", "100", "100", "1", "1"]],
    ["economy", "BankLiquidity", ["10", "3", "2", "100", "100", "100", "1", "0"]],
  ];
  const storyType = schema.types["world_native::ownership::Story"];
  if (storyType.type !== "enum") throw new Error("Expected story enum");
  const { decoder, fold } = setup();
  const events = cases.map(([domain, story, payload], index) => {
    const variant = storyType.variants.findIndex(({ name }) => name === story);
    expect(variant).toBeGreaterThanOrEqual(0);
    const layout = schema.domains[domain].events.find(({ name }) => name === "StoryEvent")!;
    return decoder.decode({
      ...raw({
        from_address: manifest.native.domains[domain].address,
        keys: [...layout.prefix, "1", "1", String(100 + index), "0", "0x123", "0", "3", "0x55"],
        data: [String(variant), ...payload, "140"],
      }),
      event_index: index,
    });
  });
  const history = new HistoryStore(
    "postgres://test",
    "madara",
    manifest.world.address,
    createNativeHistoryCodec(schema),
  );
  await history.appendEvents(events);
  const insert = db.transaction.mock.calls.find(([, values]) => values?.length === 3);
  expect(insert).toBeDefined();
  const stored = JSON.parse(insert![1][2]);
  expect(stored).toHaveLength(cases.length);
  expect(stored.map((row: any) => Object.keys(row.value.story)[0])).toEqual(cases.map(([, story]) => story));
  expect(new Set(stored.map((row: any) => row.value.id)).size).toBe(cases.length);
  expect(stored[3].entities).toEqual(expect.arrayContaining(["3", "7"]));
  expect(stored[0].entities).toEqual(expect.arrayContaining(["3", "7"]));
  expect(stored[2].value.story.GuardAddStory.slot).toBe("0x0");
  expect(stored[7].value.id).not.toBe(stored[8].value.id);
  expect(db.transaction).toHaveBeenLastCalledWith("COMMIT");
  expect(fold.retainedRowCount()).toBe(0);
});
