import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { sqlApi } from "@/services/api";
import { HOVER_STYLES, LABEL_STYLES } from "@/three/utils/labels/label-config";
import { BuildingThumbs, FELT_CENTER } from "@/ui/config";
import { BaseThreeTooltip, Position } from "@/ui/design-system/molecules/base-three-tooltip";
import { formatBiomeBonus } from "@/ui/features/military";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  ActionPath,
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  divideByPrecision,
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
import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};

type InfoLabelVariant = "ally" | "attack" | "chest" | "default" | "mine" | "quest";

const INFO_LABEL_VARIANT_STYLES: Record<
  InfoLabelVariant,
  {
    default: (typeof LABEL_STYLES)[keyof typeof LABEL_STYLES];
    hover: (typeof HOVER_STYLES)[keyof typeof HOVER_STYLES];
  }
> = {
  ally: {
    default: LABEL_STYLES.ALLY,
    hover: HOVER_STYLES.ALLY,
  },
  attack: {
    default: LABEL_STYLES.ENEMY,
    hover: HOVER_STYLES.ENEMY,
  },
  chest: {
    default: LABEL_STYLES.CHEST,
    hover: HOVER_STYLES.CHEST,
  },
  default: {
    default: LABEL_STYLES.NEUTRAL,
    hover: HOVER_STYLES.NEUTRAL,
  },
  mine: {
    default: LABEL_STYLES.MINE,
    hover: HOVER_STYLES.MINE,
  },
  quest: {
    default: LABEL_STYLES.CHEST,
    hover: HOVER_STYLES.CHEST,
  },
};

const INFO_LABEL_BASE_CLASSES =
  "relative flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold leading-tight transition-colors duration-200 backdrop-blur-[2px]";

const amplifyOpacity = (color?: string) => {
  if (!color) return color;
  const match = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)$/i);
  if (!match) return color;
  const [, r, g, b, a] = match;
  const alpha = Math.min(parseFloat(a) * 1.8, 1);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const InfoLabel = ({
  variant = "default",
  className,
  children,
}: {
  variant?: InfoLabelVariant;
  className?: string;
  children: ReactNode;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const styleSet = INFO_LABEL_VARIANT_STYLES[variant] ?? INFO_LABEL_VARIANT_STYLES.default;
  const defaultBackground = amplifyOpacity(styleSet.default.backgroundColor);
  const hoverBackground = amplifyOpacity(styleSet.hover.backgroundColor) ?? defaultBackground;
  const borderColor = amplifyOpacity(styleSet.default.borderColor) ?? styleSet.default.borderColor ?? "transparent";

  return (
    <div
      className={clsx(INFO_LABEL_BASE_CLASSES, className)}
      style={{
        backgroundColor: isHovered ? (hoverBackground ?? defaultBackground) : defaultBackground,
        borderColor,
        color: styleSet.default.textColor ?? "inherit",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
};

const TooltipTitle = ({ children }: { children: ReactNode }) => {
  return (
    <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-gold/90">
      <span className="h-px flex-1 bg-gold/30" />
      <span className="px-1">{children}</span>
      <span className="h-px flex-1 bg-gold/30" />
    </div>
  );
};

const StaminaSummary = ({
  selectedEntityId,
  isExplored,
  path,
}: {
  selectedEntityId: ID | undefined;
  isExplored: boolean;
  path: ActionPath[];
}) => {
  const { currentArmiesTick } = useBlockTimestamp();
  const staminaManager = useStaminaManager(selectedEntityId || 0);
  const stamina = useMemo(() => staminaManager.getStamina(currentArmiesTick), [currentArmiesTick, staminaManager]);

  const totalCost = useMemo(() => {
    return path.reduce((acc, tile) => acc + (tile.staminaCost ?? 0), 0);
  }, [path]);

  const requiredStamina = Math.max(0, isExplored ? totalCost : configManager.getExploreStaminaCost());
  const currentStamina = Number(stamina.amount ?? 0n);
  const staminaRatio = requiredStamina === 0 ? Number.POSITIVE_INFINITY : currentStamina / requiredStamina;
  const statusColor =
    staminaRatio >= 1 ? "text-order-brilliance" : staminaRatio >= 0.5 ? "text-gold" : "text-order-giants";
  const displayRequired = requiredStamina === 0 ? "0" : `-${formatAmount(requiredStamina)}`;

  return <span className={clsx(statusColor, "text-xs font-semibold")}>{displayRequired}</span>;
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
    const isTravelAction = actionType === ActionType.Explore || actionType === ActionType.Move;

    const wheatCost = isTravelAction
      ? actionType === ActionType.Explore
        ? Math.abs(costsPerStep.exploreFoodCosts.wheatPayAmount)
        : Math.abs(costsPerStep.travelFoodCosts.wheatPayAmount * (actionPath.length - 1))
      : 0;

    const wheatRawBalance = getBalance(structureEntityId, ResourcesIds.Wheat)?.balance ?? 0;
    const wheatAvailable = divideByPrecision(Number(wheatRawBalance));
    const wheatRatio = wheatCost === 0 ? Number.POSITIVE_INFINITY : wheatAvailable / wheatCost;
    const wheatStatusColor =
      wheatRatio >= 1 ? "text-order-brilliance" : wheatRatio >= 0.5 ? "text-gold" : "text-order-giants";
    const roundedWheatCost = Math.round(wheatCost);
    const displayWheatCost = roundedWheatCost === 0 ? "0" : `-${formatAmount(roundedWheatCost)}`;

    return (
      <>
        <TooltipTitle>{actionType?.toUpperCase()}</TooltipTitle>
        {isTravelAction ? (
          <div className="mt-1 flex items-center gap-2">
            <InfoLabel variant="default" className="flex-1 items-center justify-between gap-2">
              <img src={`/images/resources/${ResourcesIds.Wheat}.png`} alt="Wheat" className="h-5 w-5 object-contain" />
              <span className={clsx("text-xs font-semibold", wheatStatusColor)}>{displayWheatCost}</span>
            </InfoLabel>
            <InfoLabel variant="mine" className="flex-1 items-center justify-between gap-2">
              <span className="text-base leading-none">⚡</span>
              <StaminaSummary selectedEntityId={selectedEntityId} isExplored={isExplored} path={actionPath.slice(1)} />
            </InfoLabel>
          </div>
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
        <InfoLabel
          variant="default"
          className="mt-2 w-full items-center justify-center text-center uppercase tracking-[0.25em] animate-pulse"
        >
          <span className="text-[10px]">Right-click to confirm</span>
        </InfoLabel>
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

  const costs = useMemo(() => {
    if (!selectedEntityTroops) {
      return {
        travelFoodCosts: { wheatPayAmount: 0, fishPayAmount: 0 },
        exploreFoodCosts: { wheatPayAmount: 0, fishPayAmount: 0 },
      };
    }

    return {
      travelFoodCosts: computeTravelFoodCosts(selectedEntityTroops.troops),
      exploreFoodCosts: computeExploreFoodCosts(selectedEntityTroops.troops),
    };
  }, [selectedEntityTroops]);

  if (!showTooltip || !selectedEntityId || !actionPath) return null;

  return (
    <BaseThreeTooltip position={Position.CLEAN} className="w-[220px]  p-0 shadow-none" visible={showTooltip}>
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

    return (
      <div className="mt-2 flex flex-col gap-3 text-xs">
        <InfoLabel variant="attack" className="items-center gap-3">
          <span className="text-2xl leading-none">⚡️</span>
          <div className="flex flex-col gap-1 text-left normal-case">
            <span className="text-xxs uppercase tracking-wide opacity-80">Stamina Check</span>
            <div className="flex items-center gap-2 text-xs font-normal">
              <span className={clsx(hasEnoughStamina ? "text-green-400" : "text-red-400", "text-sm font-bold")}>
                ({Number(stamina.amount)})
              </span>
              <span>
                {hasEnoughStamina
                  ? "Enough stamina to attack"
                  : `Need ${combatParams.stamina_attack_req} stamina to attack`}
              </span>
            </div>
          </div>
        </InfoLabel>

        <InfoLabel variant="default" className="flex-col items-start gap-3 text-left normal-case">
          <div className="flex items-center gap-3">
            <span className="text-2xl leading-none">🌍</span>
            <div className="flex flex-col">
              <span className="text-xxs uppercase tracking-wide opacity-80">Target Biome</span>
              <span className="text-xs font-semibold normal-case">{targetBiome}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-medium">
            <span className="text-xxs uppercase tracking-wide opacity-80">Troop Type</span>
            <span className="text-xxs uppercase tracking-wide opacity-80">Biome Bonus</span>

            {targetTroops?.category === TroopType.Knight && (
              <span className="font-bold text-gold">Knight (Your Army)</span>
            )}
            {targetTroops?.category !== TroopType.Knight && <span>Knight</span>}
            <span className="text-sm">{formatBiomeBonus(biomeAdvantages.knight)}</span>

            {targetTroops?.category === TroopType.Paladin && (
              <span className="font-bold text-gold">Paladin (Your Army)</span>
            )}
            {targetTroops?.category !== TroopType.Paladin && <span>Paladin</span>}
            <span className="text-sm">{formatBiomeBonus(biomeAdvantages.paladin)}</span>

            {targetTroops?.category === TroopType.Crossbowman && (
              <span className="font-bold text-gold">Crossbowman (Your Army)</span>
            )}
            {targetTroops?.category !== TroopType.Crossbowman && <span>Crossbowman</span>}
            <span className="text-sm">{formatBiomeBonus(biomeAdvantages.crossbowman)}</span>
          </div>

          {targetTroops?.category && (
            <InfoLabel variant="mine" className="flex-col items-start gap-1 text-left normal-case">
              <span className="text-xxs uppercase tracking-wide opacity-80">Your Army's Biome Effect</span>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span>
                  {formatBiomeBonus(
                    biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages],
                  )}
                </span>
                <span>
                  {biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] > 1
                    ? "Advantage in this biome"
                    : biomeAdvantages[targetTroops.category.toLowerCase() as keyof typeof biomeAdvantages] < 1
                      ? "Disadvantage in this biome"
                      : "Neutral in this biome"}
                </span>
              </div>
            </InfoLabel>
          )}
        </InfoLabel>
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
      <div className="mt-1 flex flex-col gap-1">
        {!hasEnoughCapacity && (
          <InfoLabel variant="attack" className="items-center gap-2 text-left normal-case">
            <span className="text-xl leading-none">⚠️</span>
            <div className="flex flex-col gap-0.5 text-xs font-medium">
              <span className="text-xxs uppercase tracking-wide opacity-80">Capacity Warning</span>
              <span className="text-xs font-normal">Too heavy to claim reward</span>
            </div>
          </InfoLabel>
        )}
        <InfoLabel variant="quest" className="items-center gap-2">
          <img src={BuildingThumbs.resources} className="h-7 w-7 object-contain" />
          <div className="flex flex-col gap-0.5 text-left text-xs font-medium normal-case">
            <span className="text-xxs uppercase tracking-wide opacity-80">Quest Reward</span>
            <span className="text-xs font-semibold normal-case">
              +{formatAmount(Number(rewardAmount) / 10 ** 9)} Random resource
            </span>
          </div>
        </InfoLabel>
      </div>
    );
  },
);

const ChestInfo = memo(() => {
  return (
    <InfoLabel variant="chest" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">📦</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Relic Crate</span>
        <span>Contains valuable relics that can enhance your structures and armies.</span>
        <span className="text-xxs uppercase tracking-wide">Click to open the crate and collect relics.</span>
      </div>
    </InfoLabel>
  );
});

const HelpInfo = memo(() => {
  return (
    <InfoLabel variant="ally" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">🛡️</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Help</span>
        <span>Help an army that is attacking your structure.</span>
        <span className="text-xxs uppercase tracking-wide">Click to help the army.</span>
      </div>
    </InfoLabel>
  );
});

const CreateArmyInfo = memo(() => {
  return (
    <InfoLabel variant="mine" className="mt-1 items-center gap-2 text-left normal-case">
      <span className="text-2xl leading-none">🗡️</span>
      <div className="flex flex-col gap-1 text-xs font-medium">
        <span className="text-xxs uppercase tracking-wide opacity-80">Create Army</span>
        <span>Create an army to help you explore the world.</span>
      </div>
    </InfoLabel>
  );
});
