import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientConfigManager, gameEntityKey, setBuildingCount } from "@bibliothecadao/eternum";
import { BuildingType } from "@bibliothecadao/types";
import { setComponent } from "@dojoengine/recs";
import type { AccountInterface } from "starknet";
import { ensureSettled } from "./entry";
import { createFakeGame, PLAYER, rowOf, seedExplorer, seedStructure } from "./test-support/fake-game";

afterEach(() => ClientConfigManager.instance().setActiveGame(0, 0));

const settledGame = (provisioned: boolean, troops: bigint, hasExplorer: boolean) => {
  const game = createFakeGame();
  const entity = gameEntityKey([12n]);
  seedStructure(game.components, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
  setComponent(
    game.components.BlitzSettlement,
    gameEntityKey([BigInt(PLAYER)]),
    rowOf(game.components.BlitzSettlement, { structure_ids: [12] }),
  );
  const packed = setBuildingCount(BuildingType.ResourceLabor, [0n, 0n, 0n], provisioned ? 1 : 0);
  if (provisioned)
    setComponent(
      game.components.StructureBuildings,
      entity,
      rowOf(game.components.StructureBuildings, {
        packed_counts_1: packed[0],
        packed_counts_2: packed[1],
        packed_counts_3: packed[2],
      }),
    );
  setComponent(game.components.Resource, entity, rowOf(game.components.Resource, { KNIGHT_T1_BALANCE: troops }));
  const spawn = () => seedExplorer(game.components, { explorerId: 101, owner: 12, x: 101, y: 100 });
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
    expect(await ensureSettled(game, signer as unknown as AccountInterface, "test")).toEqual({
      structures: [12],
      explorers: [101],
    });
    expect(signer.execute).toHaveBeenCalledWith([
      expect.objectContaining({ entrypoint: "provision_realm", calldata: ["28", "12"] }),
    ]);
    expect(game.actions.createExplorerArmy).toHaveBeenCalledOnce();
  });
  it("resumes a provisioned realm with an existing explorer after all T1 troops were spent", async () => {
    const { game, signer } = settledGame(true, 0n, true);
    expect(await ensureSettled(game, signer as unknown as AccountInterface, "test")).toEqual({
      structures: [12],
      explorers: [101],
    });
    expect(signer.execute).not.toHaveBeenCalled();
    expect(game.actions.createExplorerArmy).not.toHaveBeenCalled();
  });
});
