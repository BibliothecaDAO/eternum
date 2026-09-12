import { readFileSync } from "node:fs";
import { ETHEREAL_STRIDE, getLayeredAttackDistance } from "../../../packages/types/src/constants/hex";
import { describe, expect, it } from "bun:test";
import type { Account, Call, RpcProvider } from "starknet";
import { neighbor, type HarnessBot } from "./driver";
import { runLayerRoundTrip } from "./layer-round-trip";

type Position = { alt: boolean; x: number; y: number };

function fixture(
  options: { rejectExit?: boolean; discoveryOccupiesTile?: boolean; omitAlternateSpire?: boolean } = {},
) {
  let explorer: Position = { alt: false, x: 96, y: 100 };
  let stamina = 120;
  let block = 1;
  let lastEntrypoint = "";
  const calls: Call[] = [];
  const tiles = new Map<string, { coord: Position; biome: number; occupier: number; type: number }>();
  const key = (coord: Position) => `${coord.alt}:${coord.x}:${coord.y}`;
  const put = (coord: Position, occupier: number, type = 1) =>
    tiles.set(key(coord), { coord, biome: 3, occupier, type });
  put(explorer, 9);
  put({ alt: false, x: 100, y: 100 }, 11, 35);
  if (!options.omitAlternateSpire) put({ alt: true, x: 100, y: 100 }, 11, 35);
  const packed = ({
    coord,
    biome,
    occupier,
    type,
  }: {
    coord: Position;
    biome: number;
    occupier: number;
    type: number;
  }) =>
    String(
      (BigInt(coord.alt) << 127n) |
        (BigInt(coord.x) << 81n) |
        (BigInt(coord.y) << 49n) |
        (BigInt(biome) << 41n) |
        (BigInt(occupier) << 9n) |
        (BigInt(type) << 1n),
    );
  const rows = (model: string): Record<string, unknown>[] => {
    switch (model) {
      case "GameRegistry":
        return [{ game_id: 7, preset_id: 1 }];
      case "WorldConfig":
        return [{ game_id: 7, blitz_mode_on: false }];
      case "PresetConfig":
        return [
          {
            preset_id: 1,
            spire_travel_essence_cost: "10000000000",
            tick_config: { armies_tick_in_seconds: 60 },
            troop_stamina_config: {
              stamina_gain_per_tick: 30,
              stamina_explore_stamina_cost: 30,
              stamina_travel_stamina_cost: 20,
              stamina_bonus_value: 10,
            },
          },
        ];
      case "ExplorerTroops":
        return [
          {
            game_id: 7,
            explorer_id: "9",
            owner: "5",
            coord: explorer,
            troops: { stamina: { amount: stamina, updated_tick: 1 } },
          },
        ];
      case "TileOpt":
        return [...tiles.values()].map((tile) => ({ game_id: 7, data: packed(tile) }));
      default:
        throw new Error(`Unexpected model ${model}`);
    }
  };
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const models = new URL(request.url).searchParams.get("models")!.split(",");
      return Response.json({
        confirmed_block: block,
        models: models.map((model) => ({
          model,
          rows: rows(model).map((value, index) => ({ key: String(index), value })),
        })),
      });
    },
  });
  const account = {
    address: "0x123",
    async execute(input: Call) {
      calls.push(input);
      lastEntrypoint = input.entrypoint;
      block++;
      const calldata = input.calldata as string[];
      if (input.entrypoint === "toggle_alternate") {
        if (explorer.alt && options.rejectExit) return { transaction_hash: `0x${block}` };
        put(explorer, 0, 0);
        explorer = { ...explorer, alt: !explorer.alt };
        put(explorer, 9);
      } else {
        const direction = Number(calldata[3]);
        const explore = calldata[4] === "1";
        const target = explorer.alt
          ? { ...explorer, x: explorer.x + (direction === 0 ? 15 : -15) }
          : { ...neighbor(explorer, direction), alt: false };
        if (explorer.alt && explore && options.discoveryOccupiesTile) {
          put(target, 12, 38);
          stamina--;
        } else {
          put(explorer, 0, 0);
          explorer = target;
          put(explorer, 9);
        }
      }
      return { transaction_hash: `0x${block}` };
    },
  } as unknown as Account;
  const provider = {
    getBlock: async () => ({ timestamp: 6000 }),
    getTransactionStatus: async () => ({
      finality_status: "ACCEPTED_ON_L2",
      execution_status:
        options.rejectExit &&
        explorer.alt &&
        lastEntrypoint === "toggle_alternate" &&
        calls.filter((c) => c.entrypoint === "toggle_alternate").length > 1
          ? "REVERTED"
          : "SUCCEEDED",
    }),
    getTransactionReceipt: async () => ({ block_number: block }),
  } as unknown as RpcProvider;
  const bot = {
    account,
    address: account.address,
    gameId: 7,
    botId: 1,
    explorers: [{ explorerId: "9" }],
  } as HarnessBot;
  return {
    server,
    calls,
    run: () =>
      runLayerRoundTrip({
        bots: [bot],
        gameId: 7,
        provider,
        heraldUrl: `http://127.0.0.1:${server.port}`,
        troopMovementAddress: "0xa1",
        altMovementAddress: "0xa2",
      }),
  };
}

describe("Eternum layer round trip", () => {
  it("records the approach, same-coordinate crossings, 15-coordinate explore, and return", async () => {
    const context = fixture();
    try {
      const result = await context.run();
      expect(result.status).toBe("passed");
      expect(result.steps.filter(({ kind }) => kind === "approach")).toHaveLength(3);
      const steps = result.steps.filter(({ kind }) => kind !== "approach");
      expect(steps.map(({ kind }) => kind)).toEqual(["enter", "explore", "return", "exit"]);
      expect(steps.map(({ explorer }) => explorer?.alt)).toEqual([true, true, true, false]);
      expect(steps[1].explorer!.x - steps[0].explorer!.x).toBe(15);
      expect(steps[3].explorer).toEqual({ ...steps[0].explorer!, alt: false });
      expect(result.steps.every(({ transaction, explorer }) => transaction.transactionHash && explorer)).toBe(true);
      expect(context.calls.some(({ entrypoint }) => entrypoint === "explorer_extract_reward")).toBe(false);
    } finally {
      context.server.stop(true);
    }
  });

  it("can exit after discovery leaves the explorer at the spire access tile", async () => {
    const context = fixture({ discoveryOccupiesTile: true });
    try {
      const result = await context.run();
      expect(result.status).toBe("passed");
      expect(result.steps.some(({ kind }) => kind === "return")).toBe(false);
      expect(result.steps.find(({ kind }) => kind === "explore")?.exploredTile?.alt).toBe(true);
    } finally {
      context.server.stop(true);
    }
  });

  it("retains submitted transaction evidence when the exit reverts", async () => {
    const context = fixture({ rejectExit: true });
    try {
      const result = await context.run();
      expect(result.status).toBe("failed");
      expect(result.steps.at(-1)?.kind).toBe("exit");
      expect(result.steps.at(-1)?.transaction.outcome).toBe("reverted");
      expect(result.steps.at(-1)?.transaction.transactionHash).toBeDefined();
    } finally {
      context.server.stop(true);
    }
  });

  it("refuses a spire without its matching alternate row before submitting", async () => {
    const context = fixture({ omitAlternateSpire: true });
    try {
      expect((await context.run()).status).toBe("failed");
      expect(context.calls).toHaveLength(0);
    } finally {
      context.server.stop(true);
    }
  });
});

it("uses the contract movement stride for harness and client travel", () => {
  const source = readFileSync(new URL("../../../contracts/l3/game/src/models/position.cairo", import.meta.url), "utf8");
  const stride = source.match(/pub const REGULAR_TO_ALTERNATE_MAP_SCALE: u128 = (\d+);/);
  expect(stride).not.toBeNull();
  expect(ETHEREAL_STRIDE).toBe(Number(stride![1]));
});

it("measures ethereal combat range in movement steps and rejects remote cross-layer attacks", () => {
  const origin = { col: 100, row: 100, alt: true };
  expect(getLayeredAttackDistance(origin, { ...origin, col: 115 })).toBe(1);
  expect(getLayeredAttackDistance(origin, { ...origin, col: 130 })).toBe(2);
  expect(getLayeredAttackDistance(origin, { ...origin, alt: false })).toBe(1);
  expect(getLayeredAttackDistance(origin, { ...origin, col: 115, alt: false })).toBe(Infinity);
});
