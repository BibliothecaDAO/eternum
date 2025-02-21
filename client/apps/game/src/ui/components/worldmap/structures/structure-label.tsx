import { useUIStore } from "@/hooks/store/use-ui-store";
import { StructureListItem } from "@/ui/components/worldmap/structures/structure-list-item";
import { BaseThreeTooltip, Position } from "@/ui/elements/base-three-tooltip";
import { Headline } from "@/ui/elements/headline";
import { ContractAddress, getGuildFromPlayerAddress, getStructure, Structure } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { memo, useMemo } from "react";
import { ImmunityTimer } from "./immunity-timer";

export const StructureInfoLabel = memo(() => {
  const dojo = useDojo();

  const { isMapView } = useQuery();
  const hoveredStructure = useUIStore((state) => state.hoveredStructure);

  const structure = useMemo(() => {
    return getStructure(
      hoveredStructure?.entityId || 0,
      ContractAddress(dojo.account.account.address),
      dojo.setup.components,
    );
  }, [hoveredStructure]);

  const playerGuild = getGuildFromPlayerAddress(ContractAddress(structure?.owner || 0n), dojo.setup.components);

  return (
    <>
      {structure && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[350px]`}>
          <div className="flex flex-col gap-1">
            <Headline className="text-center text-lg">
              <div>{structure.ownerName}</div>
              {playerGuild && (
                <div>
                  {"< "}
                  {playerGuild.name}
                  {" >"}
                </div>
              )}
            </Headline>
            <StructureListItem
              structure={structure as Structure}
              ownArmySelected={undefined}
              setShowMergeTroopsPopup={() => {}}
              maxInventory={3}
            />
            <ImmunityTimer structure={structure} />
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
});

StructureInfoLabel.displayName = "StructureInfoLabel";
