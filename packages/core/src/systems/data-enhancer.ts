import { ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { StaminaManager } from "../managers";
import { ActiveProduction, ArmyMapData, GuardArmy, MapDataStore } from "../stores/map-data-store";

/**
 * DataEnhancer - Handles all data fetching and enhancement from MapDataStore
 *
 * This class is responsible for enriching component data with additional information
 * from the MapDataStore, separating data fetching concerns from update logic.
 */
export class DataEnhancer {
  constructor(private mapDataStore: MapDataStore) {}

  /**
   * Enhance army data with information from MapDataStore
   */
  async enhanceArmyData(
    occupierId: ID,
    explorer: { troopType: TroopType; troopTier: TroopTier },
    currentArmiesTick: number,
  ): Promise<{
    troopCount: number;
    currentStamina: number;
    onChainStamina?: { amount: bigint; updatedTick: number };
    owner: { address: bigint | undefined; ownerName: string; guildName: string };
  }> {
    const armyMapData = await this.mapDataStore.getArmyByIdAsync(occupierId);

    const currentStamina = this.calculateCurrentStamina(armyMapData || null, explorer, currentArmiesTick);
    const owner = await this.getArmyOwnerData(armyMapData || null);

    return {
      troopCount: armyMapData?.count || 0,
      currentStamina,
      onChainStamina: armyMapData
        ? {
            amount: BigInt(armyMapData.stamina.amount),
            updatedTick: Number(armyMapData.stamina.updated_tick) || 0,
          }
        : undefined,
      owner,
    };
  }

  /**
   * Calculate current stamina for an army
   */
  private calculateCurrentStamina(
    armyMapData: ArmyMapData | null,
    explorer: { troopType: TroopType; troopTier: TroopTier },
    currentArmiesTick: number,
  ): number {
    if (!armyMapData) return 0;

    return Number(
      StaminaManager.getStamina(
        {
          category: explorer.troopType,
          tier: explorer.troopTier,
          count: BigInt(armyMapData.count),
          stamina: {
            amount: BigInt(armyMapData.stamina.amount),
            updated_tick: BigInt(armyMapData.stamina.updated_tick),
          },
          boosts: {
            incr_stamina_regen_percent_num: 0,
            incr_stamina_regen_tick_count: 0,
            incr_explore_reward_percent_num: 0,
            incr_explore_reward_end_tick: 0,
            incr_damage_dealt_percent_num: 0,
            incr_damage_dealt_end_tick: 0,
            decr_damage_gotten_percent_num: 0,
            decr_damage_gotten_end_tick: 0,
          },
        },
        currentArmiesTick,
      ).amount,
    );
  }

  /**
   * Get army owner data
   */
  private async getArmyOwnerData(
    armyMapData: ArmyMapData | null,
  ): Promise<{ address: bigint | undefined; ownerName: string; guildName: string }> {
    return {
      address: armyMapData ? BigInt(armyMapData.ownerAddress) : undefined,
      ownerName: armyMapData?.ownerName || "",
      guildName: "",
    };
  }

  /**
   * Get structure owner address
   */
  async getStructureOwner(structureId: ID): Promise<{ address: bigint | undefined; ownerName: string } | undefined> {
    const structureMapData = await this.mapDataStore.getStructureByIdAsync(structureId);
    return structureMapData
      ? { address: BigInt(structureMapData.ownerAddress), ownerName: structureMapData.ownerName }
      : undefined;
  }

  /**
   * Enhance structure data with information from MapDataStore
   */
  async enhanceStructureData(occupierId: ID): Promise<{
    owner: { address: bigint | undefined; ownerName: string; guildName: string };
    guardArmies: GuardArmy[];
    activeProductions: ActiveProduction[];
  }> {
    const structureMapData = await this.mapDataStore.getStructureByIdAsync(occupierId);

    return {
      owner: {
        address: structureMapData ? BigInt(structureMapData.ownerAddress) : undefined,
        ownerName: structureMapData?.ownerName || "",
        guildName: "",
      },
      guardArmies: structureMapData?.guardArmies || [],
      activeProductions: structureMapData?.activeProductions || [],
    };
  }

  /**
   * Get hyperstructure realm count
   */
  getHyperstructureRealmCount(hyperstructureId: ID): number | undefined {
    return this.mapDataStore.getHyperstructureRealmCount(hyperstructureId);
  }

  /**
   * Enhance army label data
   */
  async enhanceArmyLabelData(ownerStructureId: ID): Promise<{
    owner: { address: bigint; ownerName: string; guildName: string };
  }> {
    const structure = await this.mapDataStore.getStructureByIdAsync(ownerStructureId);
    const address = structure?.ownerAddress || 0n;
    const playerName = await this.getPlayerName(address.toString());

    return {
      owner: {
        address: BigInt(address),
        ownerName: playerName,
        guildName: "",
      },
    };
  }

  /**
   * Get player name from address
   */
  async getPlayerName(address: string): Promise<string> {
    return await this.mapDataStore.getPlayerNameAsync(address);
  }
}
