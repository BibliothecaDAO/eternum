import { useQuery } from "@/hooks/helpers/useQuery";
import { useStructures } from "@/hooks/helpers/useStructures";
import { BaseThreeTooltip, Position } from "@/ui/elements/BaseThreeTooltip";
import { useMemo } from "react";
import useUIStore from "../../../../hooks/store/useUIStore";

export const StructureInfoLabel = () => {
  const { isMapView } = useQuery();
  const hoveredStructure = useUIStore((state) => state.hoveredStructure);
  const { getStructure } = useStructures();

  const structure = useMemo(() => {
    if (hoveredStructure) {
      const structure = getStructure(hoveredStructure.entityId);
      return structure;
    }
    return undefined;
  }, [hoveredStructure]);

  return (
    <>
      {structure && isMapView && (
        <BaseThreeTooltip position={Position.CLEAN} className={`pointer-events-none w-[250px]`}>
          <div className="flex flex-col gap-1">
            <div className="text-lg font-bold">{structure.name}</div>
            <div className="text-sm">Owner: {structure.ownerName}</div>
            <div className="text-sm">Category: {structure.category}</div>
          </div>
        </BaseThreeTooltip>
      )}
    </>
  );
};
