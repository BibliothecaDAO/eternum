import { useCallback, useMemo } from "react";

import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatBiomeBonus } from "@/ui/features/military";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { battleSimulation } from "@/ui/features/world/components/config";
import { useUIStore } from "@/hooks/store/use-ui-store";
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
      detailLabel: "Favored on this biome",
      cardClassName:
        "border-emerald-400/60 bg-[linear-gradient(180deg,rgba(11,77,54,0.82),rgba(12,28,22,0.96))] shadow-[0_14px_30px_rgba(16,185,129,0.18)]",
      badgeClassName: "border-emerald-300/40 bg-emerald-400/16 text-emerald-100",
      iconWrapClassName: "border-emerald-300/25 bg-emerald-400/12",
      valueClassName: "text-emerald-200",
    };
  }

  if (bonus < 1) {
    return {
      stateLabel: "Penalty",
      detailLabel: "Weaker on this biome",
      cardClassName:
        "border-red-400/60 bg-[linear-gradient(180deg,rgba(109,20,33,0.84),rgba(34,14,19,0.97))] shadow-[0_14px_30px_rgba(248,113,113,0.16)]",
      badgeClassName: "border-red-300/40 bg-red-400/14 text-red-100",
      iconWrapClassName: "border-red-300/25 bg-red-400/10",
      valueClassName: "text-red-200",
    };
  }

  return {
    stateLabel: "Neutral",
    detailLabel: "No combat shift here",
    cardClassName:
      "border-gold/35 bg-[linear-gradient(180deg,rgba(78,58,18,0.45),rgba(24,20,16,0.96))] shadow-[0_14px_30px_rgba(212,175,55,0.12)]",
    badgeClassName: "border-gold/25 bg-gold/10 text-gold/85",
    iconWrapClassName: "border-gold/20 bg-gold/10",
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
}

export const BiomeSummaryCard = ({ biome, onSimulateBattle, showSimulateAction = false }: BiomeSummaryCardProps) => {
  const troopBonuses = useMemo(() => buildBiomeTroopBonusCards(biome), [biome]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Biome</span>
          {showSimulateAction && onSimulateBattle ? (
            <Button
              variant="outline"
              size="xs"
              className="h-11 min-w-[90px] gap-2 rounded-full border-gold/60 px-3 text-[11px]"
              forceUppercase={false}
              onClick={onSimulateBattle}
              withoutSound
            >
              <CrosshairIcon className="h-3.5 w-3.5" />
              Battle
            </Button>
          ) : null}
        </div>
        <span className="truncate text-xs font-semibold text-gold" title={formatQuadrantBiomeLabel(biome)}>
          {formatQuadrantBiomeLabel(biome)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Army bonuses</span>
        <div aria-label="Army bonuses" className="grid auto-rows-fr grid-cols-3 gap-2" role="list">
          {troopBonuses.map(({ troopType, config, tone, displayBonus }) => (
            <div
              key={troopType}
              data-bonus-card="true"
              role="listitem"
              className={`flex h-full min-h-[132px] flex-col rounded-xl border px-2.5 py-2.5 ${tone.cardClassName}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tone.iconWrapClassName}`}
                >
                  <ResourceIcon resource={config.resourceName} size="sm" withTooltip={false} />
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] ${tone.badgeClassName}`}
                >
                  {tone.stateLabel}
                </span>
              </div>
              <div className="mt-3 flex flex-1 flex-col justify-between gap-1">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/70">
                    {config.label}
                  </span>
                  <span className={`text-xl font-bold leading-none ${tone.valueClassName}`}>{displayBonus}</span>
                </div>
                <span className="text-[10px] leading-tight text-gold/65">{tone.detailLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const UnoccupiedTileQuadrants = ({ biome }: { biome: BiomeType }) => {
  const openPopup = useUIStore((state) => state.openPopup);
  const isPopupOpen = useUIStore((state) => state.isPopupOpen);
  const setCombatSimulationBiome = useUIStore((state) => state.setCombatSimulationBiome);

  const handleSimulateBattle = useCallback(() => {
    setCombatSimulationBiome(biome);
    if (!isPopupOpen(battleSimulation)) {
      openPopup(battleSimulation);
    }
  }, [biome, isPopupOpen, openPopup, setCombatSimulationBiome]);

  return (
    <div className="h-full min-h-0">
      <EntityDetailSection compact className="flex h-full flex-col overflow-hidden" tone="highlight">
        <BiomeSummaryCard biome={biome} onSimulateBattle={handleSimulateBattle} showSimulateAction />
      </EntityDetailSection>
    </div>
  );
};
