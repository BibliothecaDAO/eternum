import { useCallback, useMemo } from "react";

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_CUE, HUD_HEADLINE, HUD_LABEL, HUD_VALUE } from "@/ui/design-system/atoms/hud-typography";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { InfoBubble } from "@/ui/features/world/components/entities/collapsible-bubble";
import Trees from "lucide-react/dist/esm/icons/trees";
import { formatBiomeBonus } from "@/ui/features/military";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { BattleLab } from "@/ui/features/military/battle/battle-lab";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";
import CrosshairIcon from "lucide-react/dist/esm/icons/crosshair";

const unoccupiedTileTroopTypes: TroopType[] = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin];

const unoccupiedTileTroopConfig: Record<
  TroopType,
  {
    resourceName: string;
    label: string;
  }
> = {
  [TroopType.Knight]: {
    resourceName: "Knight",
    label: "Knights",
  },
  [TroopType.Crossbowman]: {
    resourceName: "Crossbowman",
    label: "Crossbowmen",
  },
  [TroopType.Paladin]: {
    resourceName: "Paladin",
    label: "Paladins",
  },
};

const formatQuadrantBiomeLabel = (biome: BiomeType | string) => {
  const label = biome.toString();
  return label
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

const resolveBiomeBonusCardTone = (bonus: number) => {
  if (bonus > 1) {
    return {
      stateLabel: "Advantage",
      cardClassName:
        "border-emerald-400/60 bg-[linear-gradient(180deg,rgba(11,77,54,0.82),rgba(12,28,22,0.96))] shadow-[0_14px_30px_rgba(16,185,129,0.18)]",
      iconWrapClassName: "border-emerald-300/25 bg-emerald-400/12",
      stateTextClassName: "text-emerald-100/95",
      valueClassName: "text-emerald-200",
    };
  }

  if (bonus < 1) {
    return {
      stateLabel: "Penalty",
      cardClassName:
        "border-red-400/60 bg-[linear-gradient(180deg,rgba(109,20,33,0.84),rgba(34,14,19,0.97))] shadow-[0_14px_30px_rgba(248,113,113,0.16)]",
      iconWrapClassName: "border-red-300/25 bg-red-400/10",
      stateTextClassName: "text-red-100/95",
      valueClassName: "text-red-200",
    };
  }

  return {
    stateLabel: "Neutral",
    cardClassName:
      "border-gold/35 bg-[linear-gradient(180deg,rgba(78,58,18,0.45),rgba(24,20,16,0.96))] shadow-[0_14px_30px_rgba(212,175,55,0.12)]",
    iconWrapClassName: "border-gold/20 bg-gold/10",
    stateTextClassName: "text-gold/80",
    valueClassName: "text-gold",
  };
};

const buildBiomeTroopBonusCards = (biome: BiomeType) => {
  return unoccupiedTileTroopTypes.map((troopType) => {
    const config = unoccupiedTileTroopConfig[troopType];
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
  onSimulateBattle,
  showSimulateAction = false,
  highlightTroopType,
}: BiomeSummaryCardProps) => {
  const troopBonuses = useMemo(() => buildBiomeTroopBonusCards(biome), [biome]);
  const biomeLabel = formatQuadrantBiomeLabel(biome);

  const orderedBonuses = useMemo(() => {
    if (highlightTroopType === undefined) return troopBonuses;
    const highlighted = troopBonuses.find((row) => row.troopType === highlightTroopType);
    if (!highlighted) return troopBonuses;
    return [highlighted, ...troopBonuses.filter((row) => row.troopType !== highlightTroopType)];
  }, [highlightTroopType, troopBonuses]);

  const battleAction =
    showSimulateAction && onSimulateBattle ? (
      <button
        type="button"
        onClick={onSimulateBattle}
        className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-gold transition hover:border-gold hover:bg-gold/20"
        title="Simulate a battle in this biome"
        aria-label="Simulate battle"
      >
        <CrosshairIcon className="h-3 w-3" />
        Battle
      </button>
    ) : undefined;

  return (
    <InfoBubble title="Biome" icon={Trees} cue={battleAction} className="w-full flex-1 min-w-0">
      <div className="flex flex-col gap-2">
        <span className={`truncate ${HUD_HEADLINE}`} title={biomeLabel}>
          {biomeLabel}
        </span>
        <div aria-label="Army bonuses" className="flex w-full flex-col gap-1.5" role="list">
          {orderedBonuses.map(({ troopType, config, tone, displayBonus }) => {
            const isHighlighted = highlightTroopType !== undefined && troopType === highlightTroopType;
            return (
              <div
                key={troopType}
                data-bonus-card="true"
                role="listitem"
                className={cn(
                  "flex w-full min-w-0 items-center gap-1.5 rounded-lg border p-1 text-left",
                  tone.cardClassName,
                  isHighlighted && "ring-1 ring-gold/70 shadow-[0_0_10px_rgba(223,170,84,0.35)]",
                )}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${tone.iconWrapClassName}`}
                >
                  <ResourceIcon resource={config.resourceName} size="sm" withTooltip={false} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn("flex items-center gap-1 break-words leading-[1.05]", HUD_LABEL)}>
                    {config.label}
                    {isHighlighted && (
                      <span className="rounded-sm border border-gold/50 bg-gold/15 px-1 text-[8px] uppercase tracking-[0.18em] text-gold">
                        Your army
                      </span>
                    )}
                  </span>
                  <span className={`leading-none ${HUD_CUE} ${tone.stateTextClassName}`}>{tone.stateLabel}</span>
                </div>
                <span className={`shrink-0 leading-none ${HUD_VALUE} ${tone.valueClassName}`}>{displayBonus}</span>
              </div>
            );
          })}
        </div>
      </div>
    </InfoBubble>
  );
};

export const UnoccupiedTileQuadrants = ({ biome }: { biome: BiomeType }) => {
  const openSurface = usePopoverStore((state) => state.openSurface);

  const handleSimulateBattle = useCallback(() => {
    openSurface({ id: "battle-lab", content: <BattleLab mode="sim" initialBiome={biome} /> });
  }, [biome, openSurface]);

  return (
    <div className="h-full min-h-0 w-full">
      <EntityDetailSection compact className="flex h-full flex-col overflow-hidden" tone="highlight">
        <BiomeSummaryCard biome={biome} onSimulateBattle={handleSimulateBattle} showSimulateAction />
      </EntityDetailSection>
    </div>
  );
};
