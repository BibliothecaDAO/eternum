import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { HeraldObserver } from "./herald-observer";
import { closeHarnessSeason } from "./season-lifecycle";

const rows = (target: number, dev = false) =>
  new Map<string, Record<string, unknown>[]>([
    ["GameRegistry", [{ game_id: 1, preset_id: 10, end_at: 200, dev_mode_on: dev }]],
    [
      "PresetConfig",
      [
        {
          preset_id: 10,
          victory_points_win_config: { points_for_win: String(target * 1_000_000) },
          victory_points_grant_config: { hyp_points_per_second: 1_000_000 },
        },
      ],
    ],
    ["Hyperstructure", [{ game_id: 1, hyperstructure_id: 7, completed: true, points_multiplier: 1 }]],
    [
      "HyperstructureShareholders",
      [{ game_id: 1, hyperstructure_id: 7, start_at: 50, shareholders: [["0x1", 10000]] }],
    ],
    ["PlayerRegisteredPoints", []],
  ]);

const options = () => ({
  gameId: 1,
  heraldUrl: "http://herald.test",
  seasonSystemAddress: "0x7",
  provider: { getBlock: async () => ({ timestamp: 100 }) } as never,
  accounts: [
    {
      address: "0x1",
      account: {
        execute: mock(async () => ({ transaction_hash: "0xabc" })),
        waitForTransaction: async () => ({ execution_status: "SUCCEEDED" }),
      },
    },
  ] as never,
});

afterEach(() => mock.restore());

test("an Eternum workload below the victory target does not claim lifecycle success", async () => {
  spyOn(HeraldObserver.prototype, "readModelRows").mockResolvedValue(rows(100));
  const result = await closeHarnessSeason(options());
  expect(result.status).toBe("target-not-reached");
  expect(result.highestBotPoints).toBe(50);
});

test("a bot can close using accrued shares and verifies the registered result", async () => {
  spyOn(HeraldObserver.prototype, "readModelRows").mockResolvedValue(rows(50));
  const final = rows(50);
  final.set("GameRegistry", [{ end_at: 100, status: "Ended" }]);
  final.set("PlayerRegisteredPoints", [{ address: "0x1", registered_points: "50000000" }]);
  final.set("SeasonPrize", [{ total_registered_points: "50000000" }]);
  final.set("HyperstructureShareholders", [{ hyperstructure_id: 7, start_at: 100 }]);
  spyOn(HeraldObserver.prototype, "waitForModelRows").mockResolvedValue(final);
  const result = await closeHarnessSeason(options());
  expect(result).toMatchObject({ status: "closed", winner: "0x1", endAt: 100, transactionHash: "0xabc" });
});

test("dev mode cannot provide Eternum finalization evidence", async () => {
  spyOn(HeraldObserver.prototype, "readModelRows").mockResolvedValue(rows(50, true));
  expect(closeHarnessSeason(options())).rejects.toThrow("dev mode off");
});
