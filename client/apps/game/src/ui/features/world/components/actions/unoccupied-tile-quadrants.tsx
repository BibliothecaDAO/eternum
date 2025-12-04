import { useCallback, useMemo } from "react";

import Button from "@/ui/design-system/atoms/button";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { formatBiomeBonus } from "@/ui/features/military";
import { EntityDetailSection } from "@/ui/features/world/components/entities/layout";
import { battleSimulation } from "@/ui/features/world/components/config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import { BiomeType, TroopType } from "@bibliothecadao/types";
import { CrosshairIcon } from "lucide-react";

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

export const formatQuadrantBiomeLabel = (biome: BiomeType | string) => {
  const label = biome.toString();
  return label
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
};

export const getQuadrantBonusStyles = (bonus: number) => {
  if (bonus > 1) {
    return {
      containerClass: "border-green-500/60 bg-green-900/30 shadow-green-500/20",
      textClass: "text-green-300",
    };
  }
  if (bonus < 1) {
    return {
      containerClass: "border-red-500/60 bg-red-900/30 shadow-red-500/20",
      textClass: "text-red-300",
    };
  }
  return {
    containerClass: "border-gold/30 bg-brown-800/60 shadow-gold/10",
    textClass: "text-gold/90",
  };
};

interface BiomeSummaryCardProps {
  biome: BiomeType;
  onSimulateBattle?: () => void;
  showSimulateAction?: boolean;
}

export const BiomeSummaryCard = ({ biome, onSimulateBattle, showSimulateAction = false }: BiomeSummaryCardProps) => {
  const troopBonuses = useMemo(
    () =>
      unoccupiedTileTroopTypes
        .map((troopType) => {
          const config = unoccupiedTileTroopConfig[troopType];
          const bonus = configManager.getBiomeCombatBonus(troopType, biome);
          const styles = getQuadrantBonusStyles(bonus);
          return {
            troopType,
            config,
            bonus,
            styles,
          };
        })
        .sort((a, b) => a.bonus - b.bonus),
    [biome],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Biome</span>
          <span className="text-sm font-semibold text-gold">{formatQuadrantBiomeLabel(biome)}</span>
        </div>
        {showSimulateAction && onSimulateBattle ? (
          <Button
            variant="outline"
            size="xs"
            className="gap-2 rounded-full border-gold/60 px-3 py-1 text-[11px]"
            forceUppercase={false}
            onClick={onSimulateBattle}
            withoutSound
          >
            <CrosshairIcon className="h-3.5 w-3.5" />
            Battle
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xxs uppercase tracking-[0.3em] text-gold/60">Army bonuses</span>
        <div className="grid grid-cols-1 gap-1.5">
          {troopBonuses.map(({ troopType, config, bonus, styles }) => (
            <div
              key={troopType}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 shadow-sm ${styles.containerClass}`}
            >
              <div className="flex items-center gap-2">
                <ResourceIcon resource={config.resourceName} size="sm" withTooltip={false} />
                <span className="text-[11px] font-semibold text-gold/90">{config.label}</span>
              </div>
              <span className={`text-sm font-semibold ${styles.textClass}`}>{bonus === 1 ? "0%" : formatBiomeBonus(bonus)}</span>
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
    <div className="h-full min-h-0 overflow-auto">
      <EntityDetailSection compact className="flex h-full flex-col overflow-hidden" tone="highlight">
        <BiomeSummaryCard biome={biome} onSimulateBattle={handleSimulateBattle} showSimulateAction />
      </EntityDetailSection>
    </div>
  );
};
