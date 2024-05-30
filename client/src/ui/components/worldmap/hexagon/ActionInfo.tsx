import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";

export const ActionInfo = () => {
  const highlightPath = useUIStore((state) => state.highlightPath);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const armyMode = useUIStore((state) => state.armyMode);

  const lastHighlightedHex = highlightPath.pos.length > 1 ? highlightPath.pos[highlightPath.pos.length - 1] : undefined;

  return (
    <>
      {lastHighlightedHex && (
        <group position={[lastHighlightedHex[0], 0.32, lastHighlightedHex[1]]}>
          <BaseThreeTooltip position={"-left-1/2 -mt-[150px]"} distanceFactor={30} className="animate-bounce">
            <div className="">info</div>
          </BaseThreeTooltip>
        </group>
      )}
    </>
  );
};
