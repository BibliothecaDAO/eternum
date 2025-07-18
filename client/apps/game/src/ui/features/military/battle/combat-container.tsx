import { env } from "@/../env";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  Biome,
  CombatSimulator,
  configManager,
  divideByPrecision,
  getAddressName,
  getEntityIdFromKeys,
  getGuardsByStructure,
  getGuildFromPlayerAddress,
  getRemainingCapacityInKg,
  getTroopResourceId,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { EntityRelicEffect } from "@bibliothecadao/torii";
import {
  CapacityConfig,
  ClientComponents,
  ContractAddress,
  getDirectionBetweenAdjacentHexes,
  ID,
  RESOURCE_PRECISION,
  resources,
  ResourcesIds,
  StructureType,
  Troops,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { ActiveRelicEffects } from "../../world/components/entities/active-relic-effects";
import { AttackTarget, TargetType } from "./attack-container";
import { BattleStats, CombatLoading, ResourceStealing, TroopDisplay } from "./components";

// Add the new function before the CombatContainer component
const getFormattedCombatTweet = ({
  attackerArmyData,
  target,
  accountName,
  accountAddress,
  targetArmyData,
  components,
}: {
  attackerArmyData: { troops: Troops } | null;
  target: AttackTarget;
  accountName: string | null;
  accountAddress: string;
  targetArmyData: { troops: Troops } | null;
  components: ClientComponents;
}) => {
  if (!attackerArmyData || !targetArmyData) return undefined;

  const attackerGuild = getGuildFromPlayerAddress(ContractAddress(accountAddress), components)?.name;
  const defenderGuild = getGuildFromPlayerAddress(ContractAddress(target.addressOwner || 0n), components)?.name;

  return formatSocialText(twitterTemplates.combat, {
    attackerNameText: `${accountName || accountAddress.slice(0, 6) + "..." + accountAddress.slice(-4)} ${attackerGuild ? `from ${attackerGuild} tribe` : ""}`,
    attackerTroopsText: `${Math.floor(divideByPrecision(Number(attackerArmyData.troops.count)))} ${TroopTier[attackerArmyData.troops.tier as TroopTier]} ${TroopType[attackerArmyData.troops.category as TroopType]}`,
    defenderTroopsText: `${Math.floor(divideByPrecision(Number(targetArmyData.troops.count)))} ${TroopTier[targetArmyData.troops.tier as TroopTier]} ${TroopType[targetArmyData.troops.category as TroopType]}`,
    defenderNameText: `${target.addressOwner ? getAddressName(target.addressOwner, components) : "@daydreamsagents"} ${defenderGuild ? `from ${defenderGuild}` : ""}`,
    url: env.VITE_SOCIAL_LINK,
  });
};

enum AttackerType {
  Structure,
  Army,
}

export const CombatContainer = ({
  attackerEntityId,
  target,
  targetResources,
  attackerActiveRelicEffects = [],
  targetActiveRelicEffects = [],
}: {
  attackerEntityId: ID;
  target: AttackTarget;
  targetResources: Array<{ resourceId: number; amount: number }>;
  attackerActiveRelicEffects: EntityRelicEffect[];
  targetActiveRelicEffects: EntityRelicEffect[];
}) => {
  const {
    account: { account },
    setup: {
      systemCalls: { attack_explorer_vs_explorer, attack_explorer_vs_guard, attack_guard_vs_explorer },
      components,
      components: { Structure, ExplorerTroops },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);
  const [selectedGuardSlot, setSelectedGuardSlot] = useState<number | null>(null);
  const accountName = useAccountStore((state) => state.accountName);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);

  const toggleModal = useUIStore((state) => state.toggleModal);

  const selectedHex = useUIStore((state) => state.selectedHex);

  const combatConfig = useMemo(() => {
    return configManager.getCombatConfig();
  }, []);

  const biome = useMemo(() => {
    return Biome.getBiome(target.hex.x, target.hex.y);
  }, [target]);

  // Determine if the attacker is a structure or an explorer
  const attackerType = useMemo(() => {
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    return structure ? AttackerType.Structure : AttackerType.Army;
  }, [attackerEntityId, Structure]);

  // Get all guards for the structure if the attacker is a structure
  const structureGuards = useMemo(() => {
    if (attackerType !== AttackerType.Structure) return [];
    const structure = getComponentValue(Structure, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    return structure ? getGuardsByStructure(structure) : [];
  }, [attackerType, attackerEntityId, Structure]);

  // Convert relic effects to resource IDs
  const attackerRelicResourceIds = useMemo(() => {
    const { currentArmiesTick } = getBlockTimestamp();
    return attackerActiveRelicEffects
      .filter((effect) => effect.effect_end_tick > currentArmiesTick)
      .map((effect) => Number(effect.effect_resource_id)) as ResourcesIds[];
  }, [attackerActiveRelicEffects]);

  const targetRelicResourceIds = useMemo(() => {
    const { currentArmiesTick } = getBlockTimestamp();
    return targetActiveRelicEffects
      .filter((effect) => effect.effect_end_tick > currentArmiesTick)
      .map((effect) => Number(effect.effect_resource_id)) as ResourcesIds[];
  }, [targetActiveRelicEffects]);

  const attackerStamina = useMemo(() => {
    const { currentArmiesTick } = getBlockTimestamp();

    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null && structureGuards.length > 0) {
        // Auto-select the first guard if none is selected
        setSelectedGuardSlot(structureGuards[0].slot);

        // For structure guards, we need to calculate stamina differently
        const guard = structureGuards[0];
        if (!guard.troops.stamina) return 0n;

        return StaminaManager.getStamina(guard.troops, currentArmiesTick, attackerRelicResourceIds).amount;
      } else if (selectedGuardSlot !== null) {
        const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
        if (selectedGuard && selectedGuard.troops.stamina) {
          return StaminaManager.getStamina(selectedGuard.troops, currentArmiesTick, attackerRelicResourceIds).amount;
        }
      }
      return 0n;
    }
    return new StaminaManager(components, attackerEntityId).getStamina(currentArmiesTick).amount;
  }, [attackerEntityId, attackerType, components, selectedGuardSlot, structureGuards, attackerActiveRelicEffects]);

  // Get the current army states for display
  const attackerArmyData: { troops: Troops } | null = useMemo(() => {
    if (attackerType === AttackerType.Structure) {
      if (selectedGuardSlot === null) return null;

      const selectedGuard = structureGuards.find((guard) => guard.slot === selectedGuardSlot);
      if (!selectedGuard) return null;

      return {
        troops: {
          count: selectedGuard.troops.count || 0n,
          category: selectedGuard.troops.category as TroopType,
          tier: selectedGuard.troops.tier as TroopTier,
          stamina: selectedGuard.troops.stamina || { amount: 0n, updated_tick: 0n },
        },
      };
    } else {
      // attacker always synced already
      const army = getComponentValue(ExplorerTroops, getEntityIdFromKeys([BigInt(attackerEntityId)]));
      return {
        troops: {
          count: army?.troops.count || 0n,
          category: army?.troops.category as TroopType,
          tier: army?.troops.tier as TroopTier,
          stamina: army?.troops.stamina || { amount: 0n, updated_tick: 0n },
        },
      };
    }
  }, [attackerEntityId, attackerType, selectedGuardSlot, structureGuards]);

  const targetArmyData = useMemo(() => {
    if (!target?.info[0]) return null;

    return {
      troops: {
        count: target.info[0].count || 0n,
        category: target.info[0].category as TroopType,
        tier: target.info[0].tier as TroopTier,
        stamina: target.info[0].stamina,
      },
    };
  }, [target]);

  const isVillageWithoutTroops = useMemo(() => {
    return target?.structureCategory === StructureType.Village && !target?.info;
  }, [target]);

  const params = configManager.getCombatConfig();
  const combatSimulator = useMemo(() => new CombatSimulator(params), [params]);

  // Simulate battle outcome
  const battleSimulation = useMemo(() => {
    if (!attackerArmyData) return null;

    // If there are no target troops, we can claim the realm without a battle
    if (!targetArmyData) return null;

    // Convert game armies to simulator armies
    const attackerArmy = {
      entity_id: attackerEntityId,
      stamina: Number(attackerStamina),
      troopCount: Number(attackerArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: attackerArmyData.troops.category as TroopType,
      tier: attackerArmyData.troops.tier as TroopTier,
    };

    const defenderArmy = {
      entity_id: target?.id || 0,
      stamina: Number(targetArmyData.troops.stamina.amount),
      troopCount: Number(targetArmyData.troops.count) / RESOURCE_PRECISION,
      troopType: targetArmyData.troops.category as TroopType,
      tier: targetArmyData.troops.tier as TroopTier,
    };

    const result = combatSimulator.simulateBattleWithParams(
      attackerArmy,
      defenderArmy,
      biome,
      attackerRelicResourceIds,
      targetRelicResourceIds,
    );

    const attackerTroopsLost = result.defenderDamage;
    const defenderTroopsLost = result.attackerDamage;

    const attackerTroopsLeft = attackerArmy.troopCount - attackerTroopsLost;
    const defenderTroopsLeft = defenderArmy.troopCount - defenderTroopsLost;

    let winner = null;
    if (attackerTroopsLeft <= 0 && defenderTroopsLeft > 0) {
      winner = defenderArmy.entity_id;
    } else if (defenderTroopsLeft <= 0 && attackerTroopsLeft > 0) {
      winner = attackerArmy.entity_id;
    }

    const newAttackerStamina =
      Math.max(Number(attackerStamina) - Number(combatConfig.stamina_attack_max), 0) +
      (winner === attackerArmy.entity_id ? Number(combatConfig.stamina_attack_req) : 0);
    const newDefenderStamina =
      Number(targetArmyData.troops.stamina.amount) -
      (winner === defenderArmy.entity_id ? Number(combatConfig.stamina_attack_req) : 0);

    return {
      attackerTroopsLeft,
      defenderTroopsLeft,
      winner,
      newAttackerStamina,
      newDefenderStamina,
      attackerDamage: result.attackerDamage,
      defenderDamage: result.defenderDamage,
      getRemainingTroops: () => ({
        attackerTroops: attackerArmy.troopCount - attackerTroopsLost,
        defenderTroops: defenderArmy.troopCount - defenderTroopsLost,
      }),
    };
  }, [
    attackerEntityId,
    target,
    account,
    components,
    attackerStamina,
    attackerArmyData,
    targetArmyData,
    biome,
    combatConfig,
    combatSimulator,
    attackerRelicResourceIds,
    targetRelicResourceIds,
  ]);

  const remainingTroops = battleSimulation?.getRemainingTroops();
  const winner = battleSimulation?.winner;

  const formattedTweet = useMemo(() => {
    return getFormattedCombatTweet({
      attackerArmyData,
      target,
      accountName,
      accountAddress: account.address,
      targetArmyData,
      components,
    });
  }, [attackerArmyData, target, accountName, account.address, targetArmyData, components]);

  const onAttack = async () => {
    if (!selectedHex) return;

    try {
      setLoading(true);

      if (attackerType === AttackerType.Structure) {
        if (selectedGuardSlot === null) return;
        await onGuardVsExplorerAttack();
      } else if (target?.targetType === TargetType.Army) {
        await onExplorerVsExplorerAttack();
      } else {
        await onExplorerVsGuardAttack();
      }

      // close modal after attack because we already know the result
      updateSelectedEntityId(null);
      toggleModal(null);
    } catch (error) {
      console.error("Attack failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const onExplorerVsGuardAttack = async () => {
    if (!selectedHex) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
    if (direction === null) return;

    await attack_explorer_vs_guard({
      signer: account,
      explorer_id: attackerEntityId,
      structure_id: target?.id || 0,
      structure_direction: direction,
    });
  };

  const remainingCapacity = useMemo(() => {
    const resource = getComponentValue(components.Resource, getEntityIdFromKeys([BigInt(attackerEntityId)]));
    const remainingCapacity = resource ? getRemainingCapacityInKg(resource) : 0;
    const remainingCapacityAfterRaid =
      remainingCapacity -
      (battleSimulation?.defenderDamage || 0) * configManager.getCapacityConfigKg(CapacityConfig.Army);
    return { beforeRaid: remainingCapacity, afterRaid: remainingCapacityAfterRaid };
  }, [battleSimulation]);

  const stealableResources = useMemo(() => {
    let capacityAfterRaid = remainingCapacity.afterRaid;
    const stealableResources: Array<{ resourceId: number; amount: number }> = [];

    // If no capacity, return empty array immediately
    if (capacityAfterRaid <= 0) {
      return stealableResources;
    }

    targetResources.forEach((resource) => {
      const availableAmount = divideByPrecision(resource.amount);
      const resourceWeight = configManager.getResourceWeightKg(resource.resourceId);
      if (capacityAfterRaid > 0) {
        let maxStealableAmount;
        if (resourceWeight === 0) {
          // If resource has no weight, can take all of it
          maxStealableAmount = availableAmount;
        } else {
          maxStealableAmount = Math.min(
            Math.floor(Number(capacityAfterRaid) / Number(resourceWeight)),
            availableAmount,
          );
        }
        if (maxStealableAmount > 0) {
          stealableResources.push({
            ...resource,
            amount: maxStealableAmount,
          });
        }
        capacityAfterRaid -= maxStealableAmount * Number(resourceWeight);
      } else {
        return; // Exit the forEach loop if no more capacity
      }
    });
    return stealableResources;
  }, [targetResources, remainingCapacity]);

  const onExplorerVsExplorerAttack = async () => {
    if (!selectedHex) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
    if (direction === null) return;

    await attack_explorer_vs_explorer({
      signer: account,
      aggressor_id: attackerEntityId,
      defender_id: target?.id || 0,
      defender_direction: direction,
      steal_resources: targetResources,
    });
  };

  const onGuardVsExplorerAttack = async () => {
    if (!selectedHex || selectedGuardSlot === null) return;
    const direction = getDirectionBetweenAdjacentHexes(selectedHex, { col: target.hex.x, row: target.hex.y });
    if (direction === null) return;

    await attack_guard_vs_explorer({
      signer: account,
      structure_id: attackerEntityId,
      structure_guard_slot: selectedGuardSlot,
      explorer_id: target?.id || 0,
      explorer_direction: direction,
    });
  };

  // Troop selector component for structure troops
  const TroopSelector = () => {
    if (attackerType !== AttackerType.Structure || structureGuards.length === 0) return null;

    return (
      <div className="p-3 sm:p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm mb-4 overflow-hidden">
        <h2 className="text-lg font-semibold text-gold mb-3">Select Attacking Troops</h2>
        <div className="flex flex-wrap gap-2 sm:gap-3" role="group" aria-label="Select troop to attack with">
          {structureGuards.map((guard) => (
            <button
              key={guard.slot}
              onClick={() => setSelectedGuardSlot(guard.slot)}
              className={`flex items-center bg-brown-900/90 border ${
                selectedGuardSlot === guard.slot ? "border-gold bg-gold/10" : "border-gold/20"
              } rounded-md px-2 sm:px-3 py-1.5 sm:py-2 hover:border-gold/60 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/50 min-w-0 flex-1 sm:flex-none`}
              aria-pressed={selectedGuardSlot === guard.slot}
              aria-label={`Select ${TroopType[guard.troops.category as TroopType]} ${guard.troops.tier} troops in slot ${guard.slot}`}
            >
              <ResourceIcon
                withTooltip={false}
                resource={
                  resources.find(
                    (r) =>
                      r.id === getTroopResourceId(guard.troops.category as TroopType, guard.troops.tier as TroopTier),
                  )?.trait || ""
                }
                size="sm"
                className="w-4 h-4 mr-2"
              />
              <div className="flex flex-col text-left min-w-0 flex-1">
                <span className="text-xs sm:text-sm text-gold/90 font-medium truncate">
                  {TroopType[guard.troops.category as TroopType]} {guard.troops.tier as TroopTier} (Slot {guard.slot})
                </span>
                <span className="text-sm sm:text-base text-gold font-bold">
                  {currencyFormat(Number(guard.troops.count || 0), 0)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const buttonMessage = useMemo(() => {
    if (isVillageWithoutTroops) return "Villages cannot be claimed";
    if (attackerStamina < combatConfig.stamina_attack_req)
      return `Not Enough Stamina (${combatConfig.stamina_attack_req} Required)`;
    if (!attackerArmyData) return "No Troops Present";
    return "Attack!";
  }, [isVillageWithoutTroops, attackerStamina, attackerArmyData, combatConfig]);

  const trueAttackDamage = useMemo(() => {
    if (!battleSimulation || !targetArmyData) return 0;
    return Math.min(battleSimulation.attackerDamage, Number(divideByPrecision(Number(targetArmyData.troops.count))));
  }, [battleSimulation, targetArmyData]);

  const trueDefenseDamage = useMemo(() => {
    if (!battleSimulation || !attackerArmyData) return 0;
    return Math.min(battleSimulation.defenderDamage, Number(divideByPrecision(Number(attackerArmyData.troops.count))));
  }, [battleSimulation, attackerArmyData]);

  return (
    <div
      className="flex flex-col gap-3 sm:gap-4 lg:gap-6  mx-auto max-w-full overflow-hidden"
      role="main"
      aria-label="Combat interface"
    >
      {/* Add Biome Info Panel */}
      {/* <BiomeInfoPanel biome={biome} /> */}
      {/* Troop Selector for Structure */}
      {TroopSelector()}

      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6"
        role="group"
        aria-label="Battle forces comparison"
      >
        {/* Attacker Relic Effects */}
        <ActiveRelicEffects relicEffects={attackerActiveRelicEffects} entityId={attackerEntityId} compact={true} />

        {/* Defender Relic Effects */}
        <ActiveRelicEffects relicEffects={targetActiveRelicEffects} entityId={target.id} compact={true} />

        {/* Attacker Panel */}
        <div className="space-y-3 sm:space-y-4" role="region" aria-label="Attacker forces information">
          {attackerArmyData && (
            <TroopDisplay
              troops={attackerArmyData.troops}
              title="Attacker Forces (You)"
              isAttacker={true}
              biome={biome}
              stamina={attackerStamina}
              staminaModifier={combatSimulator.calculateStaminaModifier(Number(attackerStamina), true)}
              losses={trueDefenseDamage}
              showLosses={!!battleSimulation}
              remainingTroops={remainingTroops?.attackerTroops}
              showRemaining={!!battleSimulation && !!remainingTroops}
            />
          )}
        </div>

        {/* Defender Panel */}
        <div className="space-y-3 sm:space-y-4" role="region" aria-label="Defender forces information">
          {targetArmyData ? (
            <TroopDisplay
              troops={targetArmyData.troops}
              title="Defender Forces"
              isAttacker={false}
              biome={biome}
              stamina={targetArmyData.troops.stamina.amount}
              staminaModifier={combatSimulator.calculateStaminaModifier(
                Number(targetArmyData.troops.stamina.amount),
                false,
              )}
              losses={trueAttackDamage}
              showLosses={!!battleSimulation}
              remainingTroops={remainingTroops?.defenderTroops}
              showRemaining={!!battleSimulation && !!remainingTroops}
            />
          ) : (
            <div className="p-4 border border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm">
              <h4 className="text-lg font-semibold text-gold mb-3">Defender Forces</h4>
              <div
                className="p-3 border border-gold/10 rounded bg-dark-brown/50"
                role="status"
                aria-label="No defending troops present"
              >
                <h4 className="text-sm font-medium text-gold/90 mb-2">No Troops Present</h4>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Battle Results */}
      {targetArmyData && attackerArmyData && (
        <div className="mt-2 space-y-3 sm:space-y-4 lg:space-y-6" role="region" aria-label="Battle simulation results">
          {battleSimulation && remainingTroops ? (
            <>
              {/* Battle Stats Summary */}
              <div className="p-3 sm:p-4 lg:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
                <BattleStats
                  attackerCasualties={trueDefenseDamage}
                  defenderCasualties={trueAttackDamage}
                  attackerCasualtyPercentage={Math.round(
                    (trueDefenseDamage / divideByPrecision(Number(attackerArmyData.troops.count))) * 100,
                  )}
                  defenderCasualtyPercentage={Math.round(
                    (trueAttackDamage / divideByPrecision(Number(targetArmyData.troops.count))) * 100,
                  )}
                  staminaChange={battleSimulation.newAttackerStamina - Number(attackerStamina)}
                  outcome={winner === attackerEntityId ? "Victory" : winner === null ? "Draw" : "Defeat"}
                />
              </div>

              {/* Resources to be stolen section - only show when winner is attacker and target is Army */}
              {winner === attackerEntityId &&
                target?.targetType === TargetType.Army &&
                stealableResources.length > 0 && (
                  <div className="p-3 sm:p-4 lg:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
                    <ResourceStealing stealableResources={stealableResources} />
                  </div>
                )}
            </>
          ) : (
            <div className="p-3 sm:p-4 lg:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg">
              <CombatLoading message="Simulating battle outcome..." />
            </div>
          )}
        </div>
      )}

      {/* No Troops Message */}
      {!targetArmyData && attackerArmyData && (
        <div
          className="mt-2 p-3 sm:p-4 lg:p-6 border border-gold/20 rounded-lg backdrop-blur-sm panel-wood shadow-lg"
          role="region"
          aria-label="Claim opportunity information"
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-gold border-b border-gold/20 pb-3 sm:pb-4">
            Claim Opportunity
          </h2>
          <div className="text-center py-3 sm:py-4">
            <div className="text-lg sm:text-xl font-bold text-green-400 mb-2" role="status">
              No Defending Troops Present!
            </div>
            {isVillageWithoutTroops ? (
              <p className="text-gold/80 mb-4" role="alert">
                Villages cannot be claimed
              </p>
            ) : (
              <p className="text-gold/80 mb-4">This realm can be claimed without a battle.</p>
            )}
          </div>
        </div>
      )}

      {/* Attack Button */}
      <div className="mt-2 mb-2 flex flex-col items-center gap-4" role="region" aria-label="Combat actions">
        <Button
          variant="primary"
          className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg transition-colors w-full sm:w-auto min-w-[200px]"
          isLoading={loading}
          disabled={attackerStamina < combatConfig.stamina_attack_req || !attackerArmyData || isVillageWithoutTroops}
          onClick={onAttack}
          aria-label={`Attack button: ${buttonMessage}`}
          aria-describedby={attackerStamina < combatConfig.stamina_attack_req ? "stamina-warning" : undefined}
        >
          {buttonMessage}
        </Button>

        {/* Stamina Warning */}
        {attackerStamina < combatConfig.stamina_attack_req && (
          <div id="stamina-warning" className="text-sm text-red-400 text-center" role="alert">
            Insufficient stamina: {Number(attackerStamina)} / {combatConfig.stamina_attack_req} required
          </div>
        )}

        {/* Twitter Share Button */}
        {formattedTweet && (
          <TwitterShareButton text={formattedTweet} callToActionText="Share your Battle" variant="outline" />
        )}
      </div>
    </div>
  );
};
