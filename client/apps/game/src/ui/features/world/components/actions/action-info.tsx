import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/design-system/molecules/base-three-tooltip";
import { Headline } from "@/ui/design-system/molecules/headline";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { StaminaResourceCost } from "@/ui/design-system/molecules/stamina-resource-cost";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  getBalance,
  getGuardsByStructure,
  getRemainingCapacityInKg,
} from "@bibliothecadao/eternum";
import { useDojo, useStaminaManager } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient, QuestTileData } from "@bibliothecadao/torii";
import { BiomeType, ClientComponents, ID, ResourcesIds, TroopType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};

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
        ) : actionType === ActionType.Quest ? (
          <QuestInfo selectedEntityId={Number(selectedEntityId)} path={actionPath} components={components} />
        ) : actionType === ActionType.Chest ? (
          <ChestInfo />
        ) : actionType === ActionType.CreateArmy ? (
          <CreateArmyInfo />
        ) : actionType === ActionType.Help ? (
          <HelpInfo />
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
              <div>+{configManager.getExploreReward().resource_amount} Random resource</div>
            </div>
          </div>
        )}
        <div className="text-xs text-center mt-2  animate-pulse">Right-click to confirm</div>
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
        const explorer = await getExplorerFromToriiClient(toriiClient, selectedEntityId);
        setExplorer(explorer?.explorer);
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

    const staminaManager = useStaminaManager(selectedEntityId);

    const stamina = useMemo(() => {
      if (!targetTroops) return { amount: 0n, updated_tick: 0n };
      // No relic effects available in this context, pass empty array
      return staminaManager.getStamina(currentArmiesTick);
    }, [targetTroops, currentArmiesTick, staminaManager]);

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
      return "";
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

const QuestInfo = memo(
  ({
    selectedEntityId,
    path,
    components,
  }: {
    selectedEntityId: ID;
    path: ActionPath[];
    components: ClientComponents;
  }) => {
    const {
      setup: {
        components: { Tile },
      },
      network: { toriiClient },
    } = useDojo();
    const [questTileEntity, setQuestTileEntity] = useState<QuestTileData | undefined>(undefined);
    const questCoords = path[path.length - 1].hex;

    useEffect(() => {
      const fetchQuest = async () => {
        const targetEntity = getComponentValue(
          Tile,
          getEntityIdFromKeys([BigInt(questCoords.col), BigInt(questCoords.row)]),
        );
        const result = await sqlApi.fetchQuest(targetEntity?.occupier_id || 0);
        if (result) {
          setQuestTileEntity(result);
        }
      };
      fetchQuest();
    }, [questCoords, toriiClient]);

    const rewardAmount = questTileEntity?.amount ?? 0;

    const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(selectedEntityId)]));

    const remainingCapacity = useMemo(() => getRemainingCapacityInKg(resources!), [resources]);

    const hasEnoughCapacity = useMemo(() => {
      return remainingCapacity >= Number(rewardAmount) / 10 ** 9;
    }, [remainingCapacity, rewardAmount]);

    if (!questTileEntity) return null;

    return (
      <div className="flex flex-col p-1 text-xs">
        {/* Reward */}
        {!hasEnoughCapacity && (
          <div className="text-xxs font-semibold text-center bg-red/50 rounded px-1 py-0.5">
            <div className="flex">
              <span className="w-5">⚠️</span>
              <span>Too heavy to claim reward</span>
            </div>
          </div>
        )}
        <div className="flex flex-row text-xs ml-1">
          <img src={BuildingThumbs.resources} className="w-6 h-6 self-center" />
          <div className="flex flex-col p-1 text-xs">
            <div>+{formatAmount(Number(rewardAmount) / 10 ** 9)} Random resource</div>
          </div>
        </div>
      </div>
    );
  },
);

const ChestInfo = memo(() => {
  return (
    <div className="flex flex-col p-1 text-xs">
      <div className="flex flex-row text-xs ml-1">
        <div className="text-lg p-1 pr-3">📦</div>
        <div className="flex flex-col p-1 text-xs">
          <div className="font-semibold text-gold mb-1">Relic Crate</div>
          <div className=" mb-1">Contains valuable relics that can enhance your structures and armies.</div>
          <div className="text-xs ">Click to open the crate and collect relics.</div>
        </div>
      </div>
    </div>
  );
});

const HelpInfo = memo(() => {
  return (
    <div className="flex flex-col p-1 text-xs">
      <div className="flex flex-row text-xs ml-1">
        <div className="text-lg p-1 pr-3">🛡️</div>
        <div className="flex flex-col p-1 text-xs">
          <div className="font-semibold text-gold mb-1">Help</div>
          <div className=" mb-1">Help an army that is attacking your structure.</div>
          <div className="text-xs ">Click to help the army.</div>
        </div>
      </div>
    </div>
  );
});

const CreateArmyInfo = memo(() => {
  return (
    <div className="flex flex-col p-1 text-xs">
      <div className="flex flex-row text-xs ml-1">
        <div className="text-lg p-1 pr-3">🗡️</div>
        <div className="flex flex-col p-1 text-xs">
          <div className="font-semibold text-gold mb-1">Create Army</div>
          <div className=" mb-1">Create an army to help you explore the world.</div>
        </div>
      </div>
    </div>
  );
});
