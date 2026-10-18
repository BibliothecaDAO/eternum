import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudPanel, HudSelect } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { biomeDisplayName } from "@/ui/utils/biome-name";
import { type CombatSimulator, configManager } from "@bibliothecadao/eternum";
import { BiomeType, formatPercent, ResourcesIds, TroopType } from "@bibliothecadao/types";

interface BiomeEnvironmentBarProps {
  combatSimulator: CombatSimulator;
  biome: BiomeType;
  ethereal?: boolean;
  onSelect: (biome: BiomeType) => void;
}

const TROOPS: { type: TroopType; resourceId: ResourcesIds }[] = [
  { type: TroopType.Knight, resourceId: ResourcesIds.Knight },
  { type: TroopType.Crossbowman, resourceId: ResourcesIds.Crossbowman },
  { type: TroopType.Paladin, resourceId: ResourcesIds.Paladin },
];

/** Top bar of the Battle Lab: a roomy biome picker with a clear per-troop bonus row. */
export const BiomeEnvironmentBar = ({
  combatSimulator,
  biome,
  onSelect,
  ethereal = false,
}: BiomeEnvironmentBarProps) => {
  const neutral = ethereal || !configManager.hasBiomeCombatEffects();
  return (
    <HudPanel title="Battle Environment" icon="map" collapsible={false}>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        {neutral ? (
          <span className="text-hud-body text-hud-muted">
            {ethereal ? "Ethereal — neutral terrain" : "Neutral terrain"}
          </span>
        ) : (
          <HudSelect
            label="Biome"
            value={biome}
            options={Object.values(BiomeType).map((each) => ({
              value: each,
              label: biomeDisplayName(each),
              hint: TROOPS.map(
                ({ type }) =>
                  `${type} ${formatPercent(configManager.getBiomeCombatBonus(type, each) - 1, { signed: true })}`,
              ).join(" · "),
            }))}
            onChange={onSelect}
          />
        )}

        <div className="flex flex-1 items-center justify-around gap-2 rounded-lg border border-hud-divider bg-hud-well px-3 py-2">
          {TROOPS.map(({ type, resourceId }) => {
            const bonus = neutral ? 1 : configManager.getBiomeCombatBonus(type, biome);
            const tone = bonus > 1 ? "text-hud-good" : bonus < 1 ? "text-hud-bad" : "text-hud-cue";
            return (
              <div key={type} className="flex items-center gap-2">
                <ResourceIcon withTooltip={false} resource={resourceId} size="sm" />
                <div className="flex flex-col leading-none">
                  <span className="text-hud-label text-hud-cue">{type}</span>
                  <span className={cn("text-hud-strong tabular-nums", tone)}>
                    {formatPercent(bonus - 1, { signed: true })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </HudPanel>
  );
};
