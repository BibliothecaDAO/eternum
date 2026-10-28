import { biomeDisplayName } from "@/ui/utils/biome-name";
import { type ReactNode, useCallback, useMemo } from "react";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { HudButton, HudChip, HudPanel, HudRow } from "@/ui/design-system/kit/hud-elements";

import { formatBiomeBonus } from "@/ui/features/military";
import { BattleLab } from "@/ui/features/military/battle/battle-lab";
import { configManager, getTroopResourceId } from "@bibliothecadao/eternum";
import { BiomeType, TROOP_TYPES, TROOP_WORDS, TroopTier } from "@bibliothecadao/types";

/** A biome's bonus for a troop as the row says it: its word, in the tone it has for the army. */
const resolveBiomeBonusCardTone = (bonus: number) => {
  if (bonus > 1) return { stateLabel: "Advantage", textClassName: "text-hud-good" };
  if (bonus < 1) return { stateLabel: "Penalty", textClassName: "text-hud-bad" };
  return { stateLabel: "Neutral", textClassName: "text-hud-ink" };
};

const buildBiomeTroopBonusCards = (biome: BiomeType) => {
  return TROOP_TYPES.map((troopType) => {
    const config = { resourceId: getTroopResourceId(troopType, TroopTier.T1), label: TROOP_WORDS[troopType].many };
    const bonus = configManager.getBiomeCombatBonus(troopType, biome);
    const tone = resolveBiomeBonusCardTone(bonus);

    return {
      troopType,
      config,
      tone,
      displayBonus: bonus === 1 ? "0%" : formatBiomeBonus(bonus),
    };
  });
};

interface BiomeSummaryCardProps {
  biome: BiomeType;
  coordsLabel?: string;
  headerAction?: ReactNode;
  onSimulateBattle?: () => void;
  showSimulateAction?: boolean;
  /**
   * When provided, the matching troop row is sorted to the top and rendered
   * with a "Your army" highlight, while the other troop rows render in a
   * compact secondary form. Used by army tiles so the player immediately sees
   * how this biome affects *their* army.
   */
  highlightTroopType?: TroopType;
}

export const BiomeSummaryCard = ({
  biome,
  coordsLabel,
  headerAction,
  onSimulateBattle,
  showSimulateAction = false,
  highlightTroopType,
}: BiomeSummaryCardProps) => {
  const troopBonuses = useMemo(() => buildBiomeTroopBonusCards(biome), [biome]);
  const biomeLabel = biomeDisplayName(biome);

  const orderedBonuses = useMemo(() => {
    if (highlightTroopType === undefined) return troopBonuses;
    const highlighted = troopBonuses.find((row) => row.troopType === highlightTroopType);
    if (!highlighted) return troopBonuses;
    return [highlighted, ...troopBonuses.filter((row) => row.troopType !== highlightTroopType)];
  }, [highlightTroopType, troopBonuses]);

  const battleAction =
    showSimulateAction && onSimulateBattle ? (
      <HudButton
        kind="quiet"
        size="sm"
        icon="target"
        onClick={onSimulateBattle}
        title="Simulate a battle in this biome"
        aria-label="Simulate battle"
      >
        Battle
      </HudButton>
    ) : undefined;

  return (
    <HudPanel
      collapsible={false}
      title={coordsLabel ?? "Biome"}
      icon={"trees" as const}
      cue={
        <span className="flex items-center gap-1">
          {headerAction}
          {battleAction}
        </span>
      }
      className="w-full shrink-0 min-w-0"
    >
      <div className="flex flex-col gap-2">
        <span className="truncate text-hud-title text-hud-ink" title={biomeLabel}>
          {biomeLabel}
        </span>
        {configManager.hasBiomeCombatEffects() && (
          <div aria-label="Army bonuses" className="flex w-full flex-col gap-1.5" role="list">
            {orderedBonuses.map(({ troopType, config, tone, displayBonus }) => {
              const isHighlighted = highlightTroopType !== undefined && troopType === highlightTroopType;
              return (
                <div key={troopType} data-bonus-card="true" role="listitem">
                  <HudRow
                    selected={isHighlighted}
                    lead={<ResourceIcon resource={config.resourceId} size="sm" withTooltip={false} />}
                    title={
                      <span className="flex items-center gap-1">
                        {config.label}
                        {isHighlighted && <HudChip>Your army</HudChip>}
                      </span>
                    }
                    detail={<span className={tone.textClassName}>{tone.stateLabel}</span>}
                    trail={
                      <span className={cn("text-hud-strong tabular-nums", tone.textClassName)}>{displayBonus}</span>
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HudPanel>
  );
};

export const UnoccupiedTileQuadrants = ({
  biome,
  coordsLabel,
  headerAction,
}: Pick<BiomeSummaryCardProps, "biome" | "coordsLabel" | "headerAction">) => {
  const openSurface = usePopoverStore((state) => state.openSurface);

  const handleSimulateBattle = useCallback(() => {
    openSurface({ id: "battle-lab", content: <BattleLab mode="sim" initialBiome={biome} /> });
  }, [biome, openSurface]);

  return (
    <BiomeSummaryCard
      biome={biome}
      coordsLabel={coordsLabel}
      headerAction={headerAction}
      onSimulateBattle={handleSimulateBattle}
      showSimulateAction
    />
  );
};
