import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientConfigManager, setBuildingCount } from "@bibliothecadao/eternum";
import { BuildingType } from "@bibliothecadao/types";
import type { AccountInterface } from "starknet";
import { ensureSettled } from "./entry";
import {
  createFakeGame,
  PLAYER,
  writeFact,
  seedExplorer,
  seedStructure,
  seedGameRegistry,
} from "./test-support/fake-game";

afterEach(() => ClientConfigManager.instance().setActiveGame(28, 0));

const settledGame = (provisioned: boolean, troops: bigint, hasExplorer: boolean) => {
  const game = createFakeGame();
  seedGameRegistry(game.store, { status: "Live", startMainAt: 0, endAt: 1000 });
  seedStructure(game.store, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
  writeFact(game.store, "PlayerEntry", [28, PLAYER], { game_id: 28, owner: PLAYER, player: PLAYER });
  const packed = setBuildingCount(BuildingType.ResourceLabor, [0n, 0n, 0n], provisioned ? 1 : 0);
  if (provisioned)
    writeFact(game.store, "StructureBuildings", [28, 12], {
      game_id: 28,
      entity_id: 12,
      packed_counts_1: packed[0],
      packed_counts_2: packed[1],
      packed_counts_3: packed[2],
      population: { current: 0, max: 10 },
    });
  writeFact(game.store, "ResourceBalance", [28, 12, 29], {
    game_id: 28,
    entity_id: 12,
    resource_type: 29,
    balance: troops,
  });
  const spawn = () => seedExplorer(game.store, { explorerId: 101, owner: 12, x: 101, y: 100 });
  if (hasExplorer) spawn();
  game.actions.createExplorerArmy.mockImplementation(async () => {
    spawn();
    game.applySlice();
  });
  const signer = { address: "0xabc", execute: vi.fn(async () => ({ transaction_hash: "0x123" })) };
  return { game, signer };
};

describe("settlement provisioning", () => {
  it("provisions the economy even when settlement already granted T1 troops", async () => {
    const { game, signer } = settledGame(false, 100_000_000_000n, false);
    expect(await ensureSettled(game, signer as unknown as AccountInterface)).toEqual({
      structures: [12],
      explorers: [101],
    });
    expect(game.client.setup.systemCalls.provision_realm).toHaveBeenCalledWith({ signer, realm_entity_id: 12 });
    expect(signer.execute).not.toHaveBeenCalled();
    expect(game.actions.createExplorerArmy).toHaveBeenCalledOnce();
  });
  it("waits for the whole roster before acting on an already settled realm", async () => {
    const { game, signer } = settledGame(true, 100_000_000_000n, false);
    const row = game.store.require("GameRegistry", { game_id: 28 });
    writeFact(game.store, "GameRegistry", [28], { ...row, ready: false });
    const pending = ensureSettled(game, signer as unknown as AccountInterface);
    await Promise.resolve();
    expect(game.actions.createExplorerArmy).not.toHaveBeenCalled();
    writeFact(game.store, "GameRegistry", [28], { ...row, ready: true });
    game.applySlice();
    await pending;
    expect(game.actions.createExplorerArmy).toHaveBeenCalledOnce();
  });
  it("resumes a provisioned realm with an existing explorer after all T1 troops were spent", async () => {
    const { game, signer } = settledGame(true, 0n, true);
    expect(await ensureSettled(game, signer as unknown as AccountInterface)).toEqual({
      structures: [12],
      explorers: [101],
    });
    expect(signer.execute).not.toHaveBeenCalled();
    expect(game.client.setup.systemCalls.provision_realm).not.toHaveBeenCalled();
    expect(game.actions.createExplorerArmy).not.toHaveBeenCalled();
  });
});
