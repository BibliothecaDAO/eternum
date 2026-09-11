import { setBlockTimestampSource } from "../utils/timestamp";
// @vitest-environment node

import { ContractAddress, createClientComponents, defineContractComponents } from "@bibliothecadao/types";
import { createWorld, setComponent, removeComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientConfigManager } from "./config-manager";
import { LeaderboardManager } from "./leaderboard-manager";

const PLAYER = 0x3e1a40b7n;
const POINTS_PRECISION = 1_000_000n;

afterEach(() => {
  ClientConfigManager.instance().setActiveGame(0, 0);
  setBlockTimestampSource(null);
  vi.restoreAllMocks();
});

describe("LeaderboardManager game scoping", () => {
  it("reads registered points from the active game's row, not another game's row for the same address", () => {
    const components = createTestComponents();
    // Seed the current game first, then an older game's row for the same
    // address, so an unscoped address-keyed pass would let the old row win.
    seedRegisteredPoints(components, 23, PLAYER, 17_332n);
    seedRegisteredPoints(components, 15, PLAYER, 5_275n);
    const manager = new LeaderboardManager(components);

    ClientConfigManager.instance().setActiveGame(23, 0);
    expect(manager.getPlayerRegisteredPoints(ContractAddress(PLAYER))).toBe(17_332);

    ClientConfigManager.instance().setActiveGame(15, 0);
    expect(manager.getPlayerRegisteredPoints(ContractAddress(PLAYER))).toBe(5_275);
  });

  it("builds the points map from active-game rows only", () => {
    const components = createTestComponents();
    seedRegisteredPoints(components, 23, PLAYER, 17_332n);
    seedRegisteredPoints(components, 15, PLAYER, 5_275n);
    ClientConfigManager.instance().setActiveGame(23, 0);
    const manager = new LeaderboardManager(components);

    const pointsPerPlayer = (manager as unknown as { getPlayerPoints: () => Map<ContractAddress, number> })[
      "getPlayerPoints"
    ]();

    expect(pointsPerPlayer.get(ContractAddress(PLAYER))).toBe(17_332);
  });

  it("keeps legacy single-game worlds (no active game id) unfiltered", () => {
    const components = createTestComponents();
    seedRegisteredPoints(components, 0, PLAYER, 1_460n);
    ClientConfigManager.instance().setActiveGame(0, 0);
    const manager = new LeaderboardManager(components);

    expect(manager.getPlayerRegisteredPoints(ContractAddress(PLAYER))).toBe(1_460);
  });
});

function createTestComponents() {
  const world = createWorld();
  return createClientComponents({ contractComponents: defineContractComponents(world) });
}

function seedRegisteredPoints(
  components: ReturnType<typeof createTestComponents>,
  gameId: number,
  address: bigint,
  points: bigint,
) {
  setComponent(components.PlayerRegisteredPoints, getEntityIdFromKeys([BigInt(gameId), address]), {
    game_id: gameId,
    address,
    registered_points: points * POINTS_PRECISION,
  });
}

it("replaces elapsed shares with registered points immediately after a checkpoint", () => {
  const components = createTestComponents();
  const config = ClientConfigManager.instance();
  config.setActiveGame(23, 0);
  vi.spyOn(config, "getHyperstructureConfig").mockReturnValue({ pointsPerCycle: 1 } as ReturnType<
    typeof config.getHyperstructureConfig
  >);
  vi.spyOn(config, "getSeasonConfig").mockReturnValue({ endAt: 200 } as ReturnType<typeof config.getSeasonConfig>);
  vi.spyOn(config, "getDevModeConfig").mockReturnValue({ dev_mode_on: false });
  setBlockTimestampSource(() => 150);
  const entity = getEntityIdFromKeys([23n, 7n]);
  setComponent(components.Hyperstructure, entity, {
    game_id: 23,
    hyperstructure_id: 7,
    initialized: true,
    completed: true,
    access: "Public",
    randomness: 0n,
    points_multiplier: 2,
  });
  const shares = {
    game_id: 23,
    hyperstructure_id: 7,
    start_at: 100n,
    shareholders: [[PLAYER, 10000n]] as unknown as number[],
  };
  setComponent(components.HyperstructureShareholders, entity, shares);
  const manager = new LeaderboardManager(components);
  manager.updatePoints();
  const readConfig = vi.spyOn(config, "getHyperstructureConfig");
  readConfig.mockClear();
  for (let index = 0; index < 20; index++) {
    expect(manager.getPlayerHyperstructureUnregisteredShareholderPoints(ContractAddress(PLAYER))).toBe(100);
  }
  expect(readConfig).not.toHaveBeenCalled();
  expect(manager.getPlayerHyperstructurePointsBreakdown(ContractAddress(PLAYER))[0].totalPoints).toBe(100);
  seedRegisteredPoints(components, 23, PLAYER, 100n);
  setComponent(components.HyperstructureShareholders, entity, { ...shares, start_at: 150n });
  manager.updatePoints();
  expect(manager.getPlayerHyperstructureUnregisteredShareholderPoints(ContractAddress(PLAYER))).toBe(0);
  expect(manager.getPlayerRegisteredPoints(ContractAddress(PLAYER))).toBe(100);

  const hyperstructure = getComponentValue(components.Hyperstructure, entity)!;
  removeComponent(components.Hyperstructure, entity);
  setComponent(components.HyperstructureShareholders, entity, shares);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(() => manager.updatePoints()).not.toThrow();
  expect(warning).toHaveBeenCalledWith("LeaderboardManager: waiting for hyperstructure row", {
    entity: String(entity),
  });
  setComponent(components.Hyperstructure, entity, hyperstructure);
  manager.updatePoints();
  expect(manager.getPlayerHyperstructureUnregisteredShareholderPoints(ContractAddress(PLAYER))).toBe(100);
});
