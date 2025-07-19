import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { ArmyChip } from "@/ui/features/military";
import { getEntityIdFromKeys, ResourceManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ArmyInfo } from "@bibliothecadao/types";
import { useComponentValue, useEntityQuery } from "@dojoengine/react";
import { Entity, getComponentValue, HasValue } from "@dojoengine/recs";
import { ArmyWarning } from "./army-warning";

export const SelectedArmyContent = ({ playerArmy }: { playerArmy: ArmyInfo }) => {
  const {
    setup: { components },
  } = useDojo();
  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(playerArmy.explorer.owner)]));
  const explorerResources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(playerArmy.entityId)]));
  const activeRelicEntities = useEntityQuery([HasValue(components.RelicEffect, { entity_id: playerArmy.entityId })]);

  const { currentArmiesTick } = useBlockTimestamp();

  // todo: check relic effect active
  const activeRelicEffects = Array.from(activeRelicEntities)
    .map((entity) => {
      return getComponentValue(components.RelicEffect, entity as Entity);
    })
    .filter((relic) => relic !== undefined)
    .filter((relic) =>
      ResourceManager.isRelicActive(
        {
          start_tick: relic.effect_start_tick,
          end_tick: relic.effect_end_tick,
          usage_left: relic.effect_usage_left,
        },
        currentArmiesTick,
      ),
    );

  return (
    <div
      className={`
        fixed left-1/2 transform -translate-x-1/2
        bg-black/80 p-2 rounded-lg panel-wood
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        bottom-0 opacity-100
      `}
    >
      <div className="flex flex-col w-[27rem]">
        {resources && explorerResources && (
          <ArmyWarning
            army={playerArmy.explorer}
            explorerResources={explorerResources}
            structureResources={resources}
            relicEffects={activeRelicEffects}
          />
        )}
        <ArmyChip className="bg-black/90" army={playerArmy} showButtons={false} />
      </div>
    </div>
  );
};
