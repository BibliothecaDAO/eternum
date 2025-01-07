import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { uuid } from "@latticexyz/utils";
import { Account, AccountInterface } from "starknet";
import { ResourcesIds } from "../constants";
import { ClientComponents } from "../dojo/components/createClientComponents";
import { EternumProvider } from "../provider";
import { ID } from "../types";
import { ResourceManager } from "./ResourceManager";

interface Troops {
  [ResourcesIds.Paladin]: number;
  [ResourcesIds.Crossbowman]: number;
  [ResourcesIds.Knight]: number;
}

export class ArmyManager {
  private readonly realmEntityId: number;

  constructor(
    // private readonly dojo: DojoResult,
    private readonly provider: EternumProvider,
    private readonly components: ClientComponents,
    private readonly armyEntityId: ID,
  ) {
    this.realmEntityId = this.getRealmEntityId();
  }

  private getRealmEntityId(): number {
    return (
      getComponentValue(this.components.EntityOwner, getEntityIdFromKeys([BigInt(this.armyEntityId)]))
        ?.entity_owner_id || 0
    );
  }

  private _updateResourceBalances(overrideId: string, troops: Troops): void {
    Object.entries(troops).forEach(([troopType, amount]) => {
      const resourceManager = new ResourceManager(
        this.components,
        this.realmEntityId,
        Number(troopType) as ResourcesIds,
      );
      resourceManager.optimisticResourceUpdate(overrideId, -BigInt(amount));
    });
  }

  private _updateArmyTroops(overrideId: string, army: any, troops: Troops): void {
    this.components.Army.addOverride(overrideId, {
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
    const army = getComponentValue(this.components.Army, entity);

    if (!army) return;

    this._updateResourceBalances(overrideId, troops);
    this._updateArmyTroops(overrideId, army, troops);
  }

  public addTroops(signer: Account | AccountInterface, troops: Troops): void {
    this.provider.army_buy_troops({
      signer,
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

  public createArmy(signer: Account | AccountInterface, structureEntityId: bigint, isDefensive: boolean): void {
    this.provider.create_army({
      signer,
      is_defensive_army: isDefensive,
      army_owner_id: structureEntityId,
    });
  }

  public async deleteArmy(signer: Account | AccountInterface, armyId: ID): Promise<void> {
    await this.provider.delete_army({
      signer,
      army_id: armyId,
    });

    this.components.Army.removeOverride(getEntityIdFromKeys([BigInt(armyId)]));
  }
}
