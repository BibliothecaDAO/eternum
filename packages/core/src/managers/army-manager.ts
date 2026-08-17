import { ClientComponents, Direction, ID, SystemCalls, TroopTier, TroopType } from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";
import { getTroopResourceId, multiplyByPrecision } from "../utils";
import { ResourceManager } from "./resource-manager";
import type { ProvisionalIntent } from "../sync/provisional-write-manager";

export class ArmyManager {
  constructor(
    private readonly systemCalls: SystemCalls,
    private readonly realmEntityId: ID,
    private readonly components: ClientComponents,
  ) {}

  public async addTroopsToExplorer(
    signer: Account | AccountInterface,
    armyEntityId: ID,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    homeDirection: Direction,
  ): Promise<void> {
    await this.withOptimisticTroopSpend(signer, troopType, troopTier, troopCount, () =>
      this.systemCalls.explorer_add({
        signer,
        to_explorer_id: armyEntityId,
        amount: multiplyByPrecision(troopCount),
        home_direction: homeDirection,
      }),
    );
  }

  public async addTroopsToGuard(
    signer: Account | AccountInterface,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    slot: number,
  ): Promise<void> {
    await this.withOptimisticTroopSpend(signer, troopType, troopTier, troopCount, () =>
      this.systemCalls.guard_add({
        signer,
        for_structure_id: this.realmEntityId,
        slot,
        category: Object.keys(TroopType).indexOf(troopType),
        tier: Object.keys(TroopTier).indexOf(troopTier),
        amount: multiplyByPrecision(troopCount),
      }),
    );
  }

  public async createExplorerArmy(
    signer: Account | AccountInterface,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    spawnDirection: Direction,
    onIntent?: (intent: ProvisionalIntent) => void,
  ): Promise<void> {
    await this.withOptimisticTroopSpend(
      signer,
      troopType,
      troopTier,
      troopCount,
      () =>
        this.systemCalls.explorer_create({
          signer,
          for_structure_id: this.realmEntityId,
          category: Object.keys(TroopType).indexOf(troopType),
          tier: Object.keys(TroopTier).indexOf(troopTier),
          amount: multiplyByPrecision(troopCount),
          spawn_direction: spawnDirection,
        }),
      onIntent,
    );
  }

  public async deleteExplorerArmy(signer: Account | AccountInterface, armyId: ID): Promise<void> {
    await this.systemCalls.explorer_delete({
      signer,
      explorer_id: armyId,
    });
  }

  private async withOptimisticTroopSpend<T>(
    signer: Account | AccountInterface,
    troopType: TroopType,
    troopTier: TroopTier,
    troopCount: number,
    submit: () => Promise<T>,
    onIntent?: (intent: ProvisionalIntent) => void,
  ): Promise<T> {
    if (!Number.isFinite(troopCount) || troopCount <= 0) return submit();

    const resourceId = getTroopResourceId(troopType, troopTier);
    const resourceManager = new ResourceManager(this.components, this.realmEntityId);
    return resourceManager.submitProvisionalResourceTransaction([{ resourceId, amount: -troopCount }], signer, submit, {
      onIntent,
    });
  }
}
