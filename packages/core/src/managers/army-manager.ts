import { ClientComponents, Direction, ID, SystemCalls, TroopTier, TroopType } from "@bibliothecadao/types";
import { Account, AccountInterface } from "starknet";
import { getTroopResourceId, multiplyByPrecision } from "../utils";
import { ResourceManager } from "./resource-manager";
import { scheduleTransactionCleanup } from "./transaction-cleanup";

const OPTIMISTIC_TROOP_SPEND_FALLBACK_TIMEOUT_MS = 180_000;

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
  ): Promise<void> {
    await this.withOptimisticTroopSpend(signer, troopType, troopTier, troopCount, () =>
      this.systemCalls.explorer_create({
        signer,
        for_structure_id: this.realmEntityId,
        category: Object.keys(TroopType).indexOf(troopType),
        tier: Object.keys(TroopTier).indexOf(troopTier),
        amount: multiplyByPrecision(troopCount),
        spawn_direction: spawnDirection,
      }),
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
  ): Promise<T> {
    const removeResourceOverride = this.optimisticTroopSpend(troopType, troopTier, troopCount);

    try {
      const result = await submit();
      this.scheduleOptimisticTroopSpendCleanup(signer, result, removeResourceOverride);
      return result;
    } catch (error) {
      removeResourceOverride();
      throw error;
    }
  }

  private optimisticTroopSpend(troopType: TroopType, troopTier: TroopTier, troopCount: number) {
    if (!Number.isFinite(troopCount) || troopCount <= 0) return () => {};

    const resourceId = getTroopResourceId(troopType, troopTier);
    const resourceManager = new ResourceManager(this.components, this.realmEntityId);
    return resourceManager.optimisticResourceUpdate(resourceId, -troopCount);
  }

  private scheduleOptimisticTroopSpendCleanup(
    signer: Account | AccountInterface,
    result: unknown,
    cleanup: () => void,
  ) {
    scheduleTransactionCleanup({
      signer,
      result,
      cleanup,
      fallbackTimeoutMs: OPTIMISTIC_TROOP_SPEND_FALLBACK_TIMEOUT_MS,
    });
  }
}
