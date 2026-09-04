// @vitest-environment node

import { ContractAddress, createClientComponents, defineContractComponents } from "@bibliothecadao/types";
import { createWorld, setComponent } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { afterEach, describe, expect, it } from "vitest";
import { ClientConfigManager } from "./config-manager";
import { LeaderboardManager } from "./leaderboard-manager";

const PLAYER = 0x3e1a40b7n;
const POINTS_PRECISION = 1_000_000n;

afterEach(() => ClientConfigManager.instance().setActiveGame(0, 0));

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
