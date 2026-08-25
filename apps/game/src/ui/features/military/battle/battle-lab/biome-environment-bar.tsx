import { HUD_CUE, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { DROPDOWN_TRIGGER, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { SelectBiome } from "@/ui/design-system/molecules/select-biome";
import { type CombatSimulator, configManager } from "@bibliothecadao/eternum";
import { BiomeType, resources, ResourcesIds, TroopType } from "@bibliothecadao/types";
import Globe from "lucide-react/dist/esm/icons/globe";

interface BiomeEnvironmentBarProps {
  combatSimulator: CombatSimulator;
  biome: BiomeType;
  onSelect: (biome: BiomeType) => void;
}

const TROOPS: { type: TroopType; resourceId: ResourcesIds; label: string }[] = [
  { type: TroopType.Knight, resourceId: ResourcesIds.Knight, label: "Knight" },
  { type: TroopType.Crossbowman, resourceId: ResourcesIds.Crossbowman, label: "Crossbow" },
  { type: TroopType.Paladin, resourceId: ResourcesIds.Paladin, label: "Paladin" },
];

const formatBonus = (bonus: number) => {
  const pct = Math.round((bonus - 1) * 100);
  return pct > 0 ? `+${pct}%` : `${pct}%`;
};

/** Top bar of the Battle Lab: a roomy biome picker with a clear per-troop bonus row. */
export const BiomeEnvironmentBar = ({ combatSimulator, biome, onSelect }: BiomeEnvironmentBarProps) => {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl px-4 py-3.5", OVERLAY_SURFACE_BASE)}>
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-gold" />
        <span className={HUD_LABEL}>Battle Environment</span>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <SelectBiome
          combatSimulator={combatSimulator}
          defaultValue={biome}
          onSelect={(next) => next && onSelect(next as BiomeType)}
          showTriggerBonuses={false}
          className={cn(DROPDOWN_TRIGGER, "sm:max-w-xs")}
        />

        <div className="flex flex-1 items-center justify-around gap-2 rounded-lg border border-gold/15 bg-black/25 px-3 py-2">
          {TROOPS.map(({ type, resourceId, label }) => {
            const bonus = configManager.getBiomeCombatBonus(type, biome);
            const tone = bonus > 1 ? "text-order-brilliance" : bonus < 1 ? "text-order-giants" : "text-gold/45";
            return (
              <div key={type} className="flex items-center gap-2">
                <ResourceIcon
                  withTooltip={false}
                  resource={resources.find((r) => r.id === resourceId)?.trait || ""}
                  size="sm"
                />
                <div className="flex flex-col leading-none">
                  <span className={cn(HUD_CUE, "text-gold/55")}>{label}</span>
                  <span className={cn("text-sm font-bold tabular-nums", tone)}>{formatBonus(bonus)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
