import { DojoResult } from "@/hooks/context/DojoContext";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { ResourceManager } from "./ResourceManager";

interface Troops {
  [ResourcesIds.Paladin]: number;
  [ResourcesIds.Crossbowman]: number;
  [ResourcesIds.Knight]: number;
}

export class ArmyManager {
  private readonly realmEntityId: number;

  constructor(
    private readonly dojo: DojoResult,
    private readonly armyEntityId: ID,
  ) {
    this.realmEntityId = this.getRealmEntityId();
  }

  private getRealmEntityId(): number {
    return (
      getComponentValue(this.dojo.setup.components.EntityOwner, getEntityIdFromKeys([BigInt(this.armyEntityId)]))
        ?.entity_owner_id || 0
    );
  }

  private _updateResourceBalances(overrideId: string, troops: Troops): void {
    Object.entries(troops).forEach(([troopType, amount]) => {
      const resourceManager = new ResourceManager(
        this.dojo.setup,
        this.realmEntityId,
        Number(troopType) as ResourcesIds,
      );
      resourceManager.optimisticResourceUpdate(overrideId, -BigInt(amount));
    });
  }

  private _updateArmyTroops(overrideId: string, army: any, troops: Troops): void {
    this.dojo.setup.components.Army.addOverride(overrideId, {
      entity: getEntityIdFromKeys([BigInt(this.armyEntityId)]),
      value: {
        ...army,
        troops: {
          knight_count: BigInt(army.troops.knight_count) + BigInt(troops[ResourcesIds.Knight]),
          crossbowman_count: BigInt(army.troops.crossbowman_count) + BigInt(troops[ResourcesIds.Crossbowman]),
          paladin_count: BigInt(army.troops.paladin_count) + BigInt(troops[ResourcesIds.Paladin]),
        },
      },
    });
  }

  private _optimisticAddTroops(overrideId: string, troops: Troops): void {
    const entity = getEntityIdFromKeys([BigInt(this.armyEntityId)]);
    const army = getComponentValue(this.dojo.setup.components.Army, entity);

    if (!army) return;

    this._updateResourceBalances(overrideId, troops);
    this._updateArmyTroops(overrideId, army, troops);
  }

  public addTroops(troops: Troops): void {
    this.dojo.setup.systemCalls.army_buy_troops({
      signer: this.dojo.account.account,
      payer_id: this.realmEntityId,
      army_id: this.armyEntityId,
      troops: {
        knight_count: BigInt(troops[ResourcesIds.Knight]),
        crossbowman_count: BigInt(troops[ResourcesIds.Crossbowman]),
        paladin_count: BigInt(troops[ResourcesIds.Paladin]),
      },
    });

    this._optimisticAddTroops(uuid(), troops);
  }

  public createArmy(structureEntityId: bigint, isDefensive: boolean): void {
    this.dojo.setup.systemCalls.create_army({
      signer: this.dojo.account.account,
      is_defensive_army: isDefensive,
      army_owner_id: structureEntityId,
    });
  }

  public async deleteArmy(armyId: ID): Promise<void> {
    await this.dojo.setup.systemCalls.delete_army({
      signer: this.dojo.account.account,
      army_id: armyId,
    });

    this.dojo.network.world.deleteEntity(getEntityIdFromKeys([BigInt(armyId)]));
  }
}
