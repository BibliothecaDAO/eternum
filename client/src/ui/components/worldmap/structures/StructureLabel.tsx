import { configManager } from "@/dojo/setup";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useIsStructureImmune, useStructures } from "@/hooks/helpers/useStructures";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { formatTime } from "@/ui/utils/utils";
import { TickIds } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";
import { StructureListItem } from "./StructureListItem";

export const ImmunityTimer = ({
  isImmune,
  timer,
  className,
}: {
  isImmune: boolean;
  timer: number;
  className?: string;
}) => {
  if (!isImmune) return null;

  return (
    <div className={`mt-2 p-2 bg-blue-500 bg-opacity-20 rounded-md ${className}`}>
      <div className="text-sm font-semibold text-blue-300">Immune</div>
      <div className="text-lg font-bold text-white animate-pulse">{formatTime(timer)}</div>
    </div>
  );
};

export const StructureInfoLabel = () => {
  const { isMapView } = useQuery();
  const hoveredStructure = useUIStore((state) => state.hoveredStructure);
  const { getStructureByEntityId } = useStructures();

  const structure = useMemo(() => {
    if (hoveredStructure) {
      const structure = getStructureByEntityId(hoveredStructure.entityId);
      return structure;
    }
    return undefined;
  }, [hoveredStructure]);

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const isImmune = useIsStructureImmune(Number(structure?.created_at || 0), nextBlockTimestamp || 0);

  const immunityEndTimestamp = useMemo(() => {
    return (
      Number(structure?.created_at || 0) +
      configManager.getBattleGraceTickCount() * configManager.getTick(TickIds.Armies)
    );
  }, [structure?.created_at]);

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp!;
  }, [immunityEndTimestamp, nextBlockTimestamp]);

  return (
    <>
      {structure && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[350px]`}>
          <div className="flex flex-col gap-1">
            <Headline className="text-center text-lg">
              <div>{structure.ownerName}</div>
            </Headline>
            <StructureListItem
              structure={structure}
              ownArmySelected={undefined}
              setShowMergeTroopsPopup={() => {}}
              maxInventory={3}
            />
            <ImmunityTimer isImmune={isImmune} timer={timer} />
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
};
