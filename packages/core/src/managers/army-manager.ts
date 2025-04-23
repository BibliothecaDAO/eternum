import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import {
  ClientComponents,
  SystemCalls,
  ID,
  TroopTier,
  TroopType,
  Direction,
  ResourcesIds,
} from "@bibliothecadao/types";
import { multiplyByPrecision } from "../utils";
import { ResourceManager } from "./resource-manager";

export class ArmyManager {
  constructor(
    private readonly systemCalls: SystemCalls,
    private readonly components: ClientComponents,
    private readonly realmEntityId: ID,
  ) {}

  private _updateResourceBalances(resourceId: ResourcesIds, amount: number): () => void {
    const resourceManager = new ResourceManager(this.components, this.realmEntityId);
    return resourceManager.optimisticResourceUpdate(resourceId, -amount);
  }

  private _updateExplorerTroops(
    armyEntityId: ID,
    army: ComponentValue<ClientComponents["ExplorerTroops"]["schema"]>,
    troopCount: number,
  ): void {
    const overrideId = uuid();
    this.components.ExplorerTroops.addOverride(overrideId, {
      entity: getEntityIdFromKeys([BigInt(armyEntityId)]),
      value: {
        ...army,
        troops: {
          ...army.troops,
          category: army.troops.category,
          tier: army.troops.tier,
          count: BigInt(army.troops.count) + BigInt(troopCount),
          stamina: army.troops.stamina,
        },
      },
    });
  }

  private _getGuardSlot(guardSlot: number, structure: ComponentValue<ClientComponents["Structure"]["schema"]>) {
    switch (guardSlot) {
      case 0:
        return structure.troop_guards.alpha;
      case 1:
        return structure.troop_guards.bravo;
      case 2:
        return structure.troop_guards.charlie;
      case 3:
        return structure.troop_guards.delta;
      default:
        throw new Error(`Invalid guard slot: ${guardSlot}`);
    }
  }

  private _updateGuardTroops(structureId: number, guardSlot: number, troopCount: number): void {
    const overrideId = uuid();
    const structureEntity = getEntityIdFromKeys([BigInt(structureId)]);
    const structure = getComponentValue(this.components.Structure, structureEntity);
    if (!structure) return;

    const guard = this._getGuardSlot(guardSlot, structure);

    if (guard) {
      const guardKey = ["alpha", "bravo", "charlie", "delta"][guardSlot];
      this.components.Structure.addOverride(overrideId, {
        entity: structureEntity,
        value: {
          ...structure,
          troop_guards: {
            ...structure.troop_guards,
            [guardKey]: {
              ...guard,
              count: BigInt(guard.count) + BigInt(troopCount),
            },
          },
        },
      });
    }
  }

  private _getTroopResourceId(troopType: TroopType, troopTier: TroopTier): ResourcesIds {
    switch (troopType) {
      case TroopType.Knight:
        return ResourcesIds.Knight;
      case TroopType.Crossbowman:
        return ResourcesIds.Crossbowman;
      case TroopType.Paladin:
        return ResourcesIds.Paladin;
    }
  }

  private _optimisticAddTroops(
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    isExplorer: boolean,
    armyEntityId?: ID,
    structureId?: number,
    guardSlot?: number,
  ): void {
    // Update resource balances for each troop type
    if (troopCount > 0) {
      const troopResourceId = this._getTroopResourceId(troopType, troopTier);
      this._updateResourceBalances(troopResourceId, troopCount);

      if (isExplorer && armyEntityId) {
        const army = getComponentValue(this.components.ExplorerTroops, getEntityIdFromKeys([BigInt(armyEntityId)]));
        if (army) {
          this._updateExplorerTroops(armyEntityId, army, multiplyByPrecision(troopCount));
        }
      } else if (structureId !== undefined && guardSlot !== undefined) {
        this._updateGuardTroops(structureId, guardSlot, multiplyByPrecision(troopCount));
      }
    }
  }

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

    this._optimisticAddTroops(troopType, troopTier, troopCount, true, armyEntityId);
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

    this._optimisticAddTroops(troopType, troopTier, troopCount, false, undefined, this.realmEntityId, slot);
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
