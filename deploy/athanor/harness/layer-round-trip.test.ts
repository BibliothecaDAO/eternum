import { statusSubscription } from "./test-observations";
import type { HarnessProvider } from "./provider";
import { ETHEREAL_STRIDE, getLayeredAttackDistance } from "@bibliothecadao/types";
import { describe, expect, it } from "bun:test";
import type { Account, Call } from "starknet";
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
      case "SliceRules":
        return [
          {
            game_id: 7,
            blitz_mode_on: false,
            spire_travel_essence_cost: 10000000000n,
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
        const explore = input.entrypoint === "explorer_explore";
        const direction = Number(explore ? calldata[2] : calldata[3]);
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
    subscribeTransactionStatus: async () =>
      statusSubscription({
        finality_status: "ACCEPTED_ON_L2",
        execution_status:
          options.rejectExit &&
          explorer.alt &&
          lastEntrypoint === "toggle_alternate" &&
          calls.filter((c) => c.entrypoint === "toggle_alternate").length > 1
            ? "REVERTED"
            : "SUCCEEDED",
      }),
    getTransactionReceipt: async () => ({
      block_number: block,
      actual_fee: { amount: "0x0", unit: "FRI" },
      execution_resources: { l1_gas: 0, l1_data_gas: 0, l2_gas: 1 },
      execution_status: "SUCCEEDED",
    }),
  } as unknown as HarnessProvider;
  const bot = {
    account,
    address: account.address,
    gameId: 7,
    botId: 1,
    explorers: [{ explorerId: 9 }],
  } as unknown as HarnessBot;
  return {
    server: { stop: (_force: boolean) => {} },
    calls,
    run: () =>
      runLayerRoundTrip({
        bots: [bot],
        gameId: 7,
        provider,
        client: {
          gameId: 7,
          setup: {
            store: {
              get: (model: string) => rows(model)[0],
              inGame: (model: string) => rows(model),
            },
            systemCalls: {
              toggle_alternate: ({ explorer_id, spire_direction }: { explorer_id: number; spire_direction: number }) =>
                account.execute({
                  contractAddress: "0xa2",
                  entrypoint: "toggle_alternate",
                  calldata: ["7", String(explorer_id), String(spire_direction)],
                }),
              explorer_travel: ({ explorer_id, directions }: { explorer_id: number; directions: number[] }) =>
                account.execute({
                  contractAddress: "0xa1",
                  entrypoint: "explorer_travel",
                  calldata: ["7", String(explorer_id), String(directions.length), ...directions.map(String)],
                }),
              explorer_explore: ({ explorer_id, directions }: { explorer_id: number; directions: number[] }) =>
                account.execute({
                  contractAddress: "0xa1",
                  entrypoint: "explorer_explore",
                  calldata: ["7", String(explorer_id), String(directions[0])],
                }),
            },
          },
        } as never,
        game: {
          submit: async (_signer: unknown, act: () => Promise<{ transaction_hash: string }>) => ({
            transactionHash: (await act()).transaction_hash,
            confirmed: Promise.resolve(),
          }),
          waitFor: async (read: () => unknown) => {
            const result = read();
            if (result === undefined) throw new Error("Expected folded tile");
            return result;
          },
        } as never,
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

it("uses a fifteen-coordinate Ethereal movement stride", () => {
  expect(ETHEREAL_STRIDE).toBe(15);
});

it("measures ethereal combat range in movement steps and rejects remote cross-layer attacks", () => {
  const origin = { col: 100, row: 100, alt: true };
  expect(getLayeredAttackDistance(origin, { ...origin, col: 115 })).toBe(1);
  expect(getLayeredAttackDistance(origin, { ...origin, col: 130 })).toBe(2);
  expect(getLayeredAttackDistance(origin, { ...origin, alt: false })).toBe(1);
  expect(getLayeredAttackDistance(origin, { ...origin, col: 115, alt: false })).toBe(Infinity);
});
