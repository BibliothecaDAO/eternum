import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { configManager, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { closeHarnessSeason } from "./season-lifecycle";

function fixture(target: number, dev = false) {
  let settled = false;
  const end = mock(async () => { settled = true; });
  const rows = (model: string) => {
    switch (model) {
      case "GameRegistry": return [{ game_id: 1, end_at: settled ? 100n : 200n, settled, dev_mode_on: dev }];
      case "SeasonWinThreshold": return [{ game_id: 1, points: BigInt(target) * 1000000n }];
      case "PointsTotal": return [{ game_id: 1, total: 50000000n }];
      case "PlayerPoints": return [{ game_id: 1, address: 1n, points: settled ? 50000000n : 0n }];
      case "HyperstructureShares": return [{ game_id: 1, start_at: settled ? 100n : 50n, multiplier: 1, shareholders: [{ player: 1n, bps: 10000 }] }];
      case "SliceRules": return [{ victory_points_grant_config: { hyp_points_per_second: 1000000 } }];
      default: throw new Error(`Unexpected model ${model}`);
    }
  };
  spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  setBlockTimestampSource(() => 100);
  return {
    end,
    options: {
      client: { gameId: 1, setup: { store: { require: (model: string) => rows(model)[0], inGame: rows }, systemCalls: { end_game: end } } },
      game: {
        submit: async (_signer: unknown, act: () => Promise<unknown>) => ({ transactionHash: "0xabc", confirmed: act() }),
        waitFor: async (read: () => unknown) => read(),
      },
      provider: {
        getTransactionStatus: async () => ({ finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" }),
        getTransactionReceipt: async () => ({ block_number: 1 }),
      },
      accounts: [{ botId: 1, address: "0x1", account: { address: "0x1" } }],
    } as unknown as Parameters<typeof closeHarnessSeason>[0],
  };
}

afterEach(() => { mock.restore(); setBlockTimestampSource(null); });

test("an Eternum workload below the victory target does not claim lifecycle success", async () => {
  const context = fixture(100);
  const result = await closeHarnessSeason(context.options);
  expect(result.status).toBe("target-not-reached");
  expect(result.highestBotPoints).toBe(50);
  expect(context.end).not.toHaveBeenCalled();
});

test("a bot closes through the client and verifies the registered result", async () => {
  const context = fixture(50);
  const result = await closeHarnessSeason(context.options);
  expect(result).toMatchObject({ status: "closed", winner: "0x1", endAt: 100 });
  expect(BigInt(result.transactionHash!)).toBe(0xabcn);
  expect(context.end).toHaveBeenCalledTimes(1);
});

test("dev mode cannot provide Eternum finalization evidence", async () => {
  const context = fixture(50, true);
  await expect(closeHarnessSeason(context.options)).rejects.toThrow("dev mode off");
  expect(context.end).not.toHaveBeenCalled();
});
