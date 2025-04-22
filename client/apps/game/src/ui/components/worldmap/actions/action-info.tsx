import { useUIStore } from "@/hooks/store/use-ui-store";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { ResourceCost } from "@/ui/elements/resource-cost";
import { StaminaResourceCost } from "@/ui/elements/stamina-resource-cost";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  getBalance,
  getExplorerFromToriiClient,
  getGuardsByStructure,
  getStructureFromToriiClient,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { BiomeType, ClientComponents, ID, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

const TooltipContent = memo(
  ({
    isExplored,
    actionPath,
    costsPerStep,
    selectedEntityId,
    structureEntityId,
    getBalance,
    components,
  }: {
    isExplored: boolean;
    actionPath: ActionPath[];
    costsPerStep: { travelFoodCosts: any; exploreFoodCosts: any };
    selectedEntityId: number;
    structureEntityId: number;
    getBalance: (entityId: ID, resourceId: ResourcesIds) => { balance: number; resourceId: ResourcesIds };
    components: ClientComponents;
  }) => {
    const actionType = ActionPaths.getActionType(actionPath);

    return (
      <>
        <Headline>{actionType?.toUpperCase()}</Headline>
        {actionType === ActionType.Explore ? (
          <div>
            <ResourceCost
              amount={-costsPerStep.exploreFoodCosts.wheatPayAmount}
              resourceId={ResourcesIds.Wheat}
              balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
            />
            <ResourceCost
              amount={-costsPerStep.exploreFoodCosts.fishPayAmount}
              resourceId={ResourcesIds.Fish}
              balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
            />
          </div>
        ) : actionType === ActionType.Move ? (
          <div>
            <ResourceCost
              amount={-costsPerStep.travelFoodCosts.wheatPayAmount * (actionPath.length - 1)}
              resourceId={ResourcesIds.Wheat}
              balance={getBalance(structureEntityId, ResourcesIds.Wheat).balance}
            />
            <ResourceCost
              amount={-costsPerStep.travelFoodCosts.fishPayAmount * (actionPath.length - 1)}
              resourceId={ResourcesIds.Fish}
              balance={getBalance(structureEntityId, ResourcesIds.Fish).balance}
            />
          </div>
        ) : null}
        {actionType === ActionType.Explore || actionType === ActionType.Move ? (
          <StaminaResourceCost
            selectedEntityId={Number(selectedEntityId)}
            isExplored={isExplored}
            path={actionPath.slice(1)}
          />
        ) : (
          <AttackInfo
            selectedEntityId={Number(selectedEntityId)}
            targetEntityId={Number(selectedEntityId)}
            path={actionPath}
          />
        )}
        {!isExplored && (
          <div className="flex flex-row text-xs ml-1">
            <img src={BuildingThumbs.resources} className="w-6 h-6 self-center" />
            <div className="flex flex-col p-1 text-xs">
              <div>+{configManager.getExploreReward()} Random resource</div>
            </div>
          </div>
        )}
        <div className="text-xs text-center mt-2 text-gray-400 animate-pulse">Right-click to confirm</div>
      </>
    );
  },
);

TooltipContent.displayName = "TooltipContent";

export const ActionInfo = memo(() => {
  const hoveredHex = useUIStore(useCallback((state) => state.entityActions.hoveredHex, []));
  const selectedEntityId = useUIStore(useCallback((state) => state.entityActions.selectedEntityId, []));
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const {
    setup: { components },
  } = useDojo();

  const selectedEntityTroops = useMemo(() => {
    if (!selectedEntityId) return undefined;
    return getComponentValue(components.ExplorerTroops, getEntityIdFromKeys([BigInt(selectedEntityId)]));
  }, [selectedEntityId]);

  const actionPath = useMemo(() => {
    if (!hoveredHex) return undefined;
    return useUIStore
      .getState()
      .entityActions.actionPaths.get(`${hoveredHex.col + FELT_CENTER},${hoveredHex.row + FELT_CENTER}`);
  }, [hoveredHex]);

  const showTooltip = useMemo(() => {
    return actionPath !== undefined && actionPath.length >= 2 && selectedEntityId !== null;
  }, [actionPath, selectedEntityId]);

  const isExplored = useMemo(() => {
    return actionPath?.[actionPath.length - 1].biomeType !== undefined;
  }, [actionPath]);

  const costs = useMemo(
    () => ({
      travelFoodCosts: selectedEntityTroops ? computeTravelFoodCosts(selectedEntityTroops.troops) : 0,
      exploreFoodCosts: selectedEntityTroops ? computeExploreFoodCosts(selectedEntityTroops.troops) : 0,
    }),
    [selectedEntityTroops],
  );

  if (!showTooltip || !selectedEntityId || !actionPath) return null;

  return (
    <BaseThreeTooltip position={Position.CLEAN} className="w-[250px]" visible={showTooltip}>
      <TooltipContent
        isExplored={isExplored}
        actionPath={actionPath}
        costsPerStep={costs}
        selectedEntityId={selectedEntityId}
        structureEntityId={selectedEntityTroops?.owner || 0}
        getBalance={(entityId: ID, resourceId: ResourcesIds) =>
          getBalance(entityId, resourceId, currentDefaultTick, components)
        }
        components={components}
      />
    </BaseThreeTooltip>
  );
});

const AttackInfo = memo(
  ({ selectedEntityId, path }: { selectedEntityId: ID; targetEntityId: ID; path: ActionPath[] }) => {
    const {
      network: { toriiClient },
    } = useDojo();
    const { currentArmiesTick } = getBlockTimestamp();

    const [explorer, setExplorer] = useState<ComponentValue<ClientComponents["ExplorerTroops"]["schema"]> | undefined>(
      undefined,
    );
    const [structure, setStructure] = useState<ComponentValue<ClientComponents["Structure"]["schema"]> | undefined>(
      undefined,
    );

    useEffect(() => {
      const fetchExplorer = async () => {
        const { explorer } = await getExplorerFromToriiClient(toriiClient, selectedEntityId);
        setExplorer(explorer);
      };
      fetchExplorer();
    }, [selectedEntityId, toriiClient]);

    useEffect(() => {
      const fetchStructure = async () => {
        if (!explorer) return;
        const result = await getStructureFromToriiClient(toriiClient, explorer.owner);
        if (result) {
          setStructure(result.structure);
        }
      };
      fetchStructure();
    }, [explorer, toriiClient]);

    const targetTroops = useMemo(() => {
      if (explorer) return explorer.troops;

      const guardTroops = structure ? getGuardsByStructure(structure)[0]?.troops : undefined;
      return guardTroops;
    }, [explorer, structure]);

    const stamina = useMemo(() => {
      if (!targetTroops) return { amount: 0n, updated_tick: 0n };
      return StaminaManager.getStamina(targetTroops, currentArmiesTick);
    }, [targetTroops, currentArmiesTick]);

    const combatParams = useMemo(() => configManager.getCombatConfig(), []);

    // Get the target biome from the path
    const targetBiome = useMemo(() => {
      return path[path.length - 1].biomeType || BiomeType.Grassland;
    }, [path]);

    // Determine if attacker has enough stamina to attack
    const hasEnoughStamina = useMemo(() => {
      const requiredStamina = combatParams.stamina_attack_req;
      return Number(stamina.amount) >= requiredStamina;
    }, [stamina, combatParams]);

    // Get biome advantages for different troop types
    const biomeAdvantages = useMemo(() => {
      return {
        knight: configManager.getBiomeCombatBonus(TroopType.Knight, targetBiome),
        paladin: configManager.getBiomeCombatBonus(TroopType.Paladin, targetBiome),
        crossbowman: configManager.getBiomeCombatBonus(TroopType.Crossbowman, targetBiome),
      };
    }, [targetBiome]);

    // Format the biome bonus as a percentage string with + or - sign
    const formatBiomeBonus = (bonus: number) => {
      const percentage = Math.round((bonus - 1) * 100);
      return percentage >= 0 ? `+${percentage}%` : `${percentage}%`;
    };

    // Determine color classes based on advantage/disadvantage
    const getBonusColorClass = (bonus: number) => {
      if (bonus > 1) return "text-green-500";
      if (bonus < 1) return "text-red-500";
      return "text-gray-400";
    };

    return (
      <div className="flex flex-col p-1 text-xs">
        {/* Stamina Status */}
        <div className="flex flex-row items-center mb-2">
          <div className="text-lg p-1 pr-3">⚡️</div>
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className={clsx(hasEnoughStamina ? "text-green-500" : "text-red-500", "font-normal")}>
                ({Number(stamina.amount)})
              </span>
              <span className="ml-2">
                {hasEnoughStamina
                  ? "Enough stamina to attack"
                  : `Need ${combatParams.stamina_attack_req} stamina to attack`}
              </span>
            </div>
          </div>
        </div>

        {/* Biome Info */}
        <div className="flex flex-col mt-2">
          <div className="font-semibold mb-1">Biome: {targetBiome}</div>

          {/* Troop Type Advantages */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div className="font-medium">Troop Type</div>
            <div className="font-medium">Biome Bonus</div>

            {/* Highlight current army's troop type */}
            {targetTroops?.category === TroopType.Knight && (
              <div className="font-bold text-gold">Knight (Your Army)</div>
            )}
            {targetTroops?.category !== TroopType.Knight && <div>Knight</div>}
            <div className={getBonusColorClass(biomeAdvantages.knight)}>{formatBiomeBonus(biomeAdvantages.knight)}</div>

            {targetTroops?.category === TroopType.Paladin && (
              <div className="font-bold text-gold">Paladin (Your Army)</div>
            )}
            {targetTroops?.category !== TroopType.Paladin && <div>Paladin</div>}
            <div className={getBonusColorClass(biomeAdvantages.paladin)}>
              {formatBiomeBonus(biomeAdvantages.paladin)}
            </div>

            {targetTroops?.category === TroopType.Crossbowman && (
              <div className="font-bold text-gold">Crossbowman (Your Army)</div>
            )}
            {targetTroops?.category !== TroopType.Crossbowman && <div>Crossbowman</div>}
            <div className={getBonusColorClass(biomeAdvantages.crossbowman)}>
              {formatBiomeBonus(biomeAdvantages.crossbowman)}
            </div>
          </div>

          {/* Your Army's Biome Bonus Summary */}
          {targetTroops?.category && (
            <div className="mt-3 p-2 bg-dark-brown/50 rounded border border-gold/20">
              <div className="font-semibold text-gold">Your Army's Biome Effect</div>
              <div className="flex items-center mt-1">
                <span
                  className={getBonusColorClass(
                    biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages],
                  )}
                >
                  {formatBiomeBonus(
                    biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages],
                  )}
                </span>
                <span className="ml-2">
                  {biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] > 1
                    ? "Advantage in this biome"
                    : biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] < 1
                      ? "Disadvantage in this biome"
                      : "Neutral in this biome"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
