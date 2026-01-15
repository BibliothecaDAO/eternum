import { Direction, ID, SystemCalls, TroopTier, TroopType } from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";
import { multiplyByPrecision } from "../utils";

export class ArmyManager {
  constructor(
    private readonly systemCalls: SystemCalls,
    private readonly realmEntityId: ID,
  ) {}

  public async addTroopsToExplorer(
    signer: Account | AccountInterface,
    armyEntityId: ID,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    homeDirection: Direction,
  ): Promise<void> {
    this.systemCalls.explorer_add({
      signer,
      to_explorer_id: armyEntityId,
      amount: multiplyByPrecision(troopCount),
      home_direction: homeDirection,
    });
  }

  // don't need to multiply by precision here because the guard_add function already does it
  public async addTroopsToGuard(
    signer: Account | AccountInterface,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    slot: number,
  ): Promise<void> {
    await this.systemCalls.guard_add({
      signer,
      for_structure_id: this.realmEntityId,
      slot,
      category: Object.keys(TroopType).indexOf(troopType),
      tier: Object.keys(TroopTier).indexOf(troopTier),
      amount: multiplyByPrecision(troopCount),
    });
  }

  // don't need to multiply by precision here because the explorer_create function already does it
  public async createExplorerArmy(
    signer: Account | AccountInterface,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    spawnDirection: Direction,
  ): Promise<void> {
    await this.systemCalls.explorer_create({
      signer,
      for_structure_id: this.realmEntityId,
      category: Object.keys(TroopType).indexOf(troopType),
      tier: Object.keys(TroopTier).indexOf(troopTier),
      amount: multiplyByPrecision(troopCount),
      spawn_direction: spawnDirection,
    });
  }

  public async deleteExplorerArmy(signer: Account | AccountInterface, armyId: ID): Promise<void> {
    await this.systemCalls.explorer_delete({
      signer,
      explorer_id: armyId,
    });
  }
}
