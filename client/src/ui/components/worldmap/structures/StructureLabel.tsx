import { useDojo } from "@/hooks/context/DojoContext";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useIsStructureImmune, useStructures } from "@/hooks/helpers/useStructures";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { formatTime } from "@/ui/utils/utils";
import { EternumGlobalConfig } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";

export const ImmunityTimer = ({ isImmune, timer }: { isImmune: boolean; timer: number }) => {
  if (!isImmune) return null;

  return (
    <div className="mt-2 p-2 bg-blue-500 bg-opacity-20 rounded-md">
      <div className="text-sm font-semibold text-blue-300">Immune</div>
      <div className="text-lg font-bold text-white animate-pulse">{formatTime(timer)}</div>
    </div>
  );
};

export const StructureInfoLabel = () => {
  const dojo = useDojo();
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
      dojo.setup.configManager.getBattleGraceTickCount() * EternumGlobalConfig.tick.armiesTickIntervalInSeconds
    );
  }, [structure?.created_at, dojo.setup.configManager]);

  const timer = useMemo(() => {
    if (!nextBlockTimestamp) return 0;
    return immunityEndTimestamp - nextBlockTimestamp!;
  }, [immunityEndTimestamp, nextBlockTimestamp]);

  return (
    <>
      {structure && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[250px]`}>
          <div className="flex flex-col gap-1">
            <Headline className="text-center text-lg">
              <div>{structure.ownerName}</div>
            </Headline>
            <div className="text-sm">Structure Name: {structure.name}</div>
            <div className="text-sm">Category: {structure.category}</div>
            <ImmunityTimer isImmune={isImmune} timer={timer} />
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
};
