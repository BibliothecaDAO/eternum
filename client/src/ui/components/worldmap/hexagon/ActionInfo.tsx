import useUIStore from "@/hooks/store/useUIStore";
import { BaseThreeTooltip } from "@/ui/elements/BaseThreeTooltip";

export const ActionInfo = () => {
  const highlightedHexes = useUIStore((state) => state.highlightPositions);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const armyMode = useUIStore((state) => state.armyMode);

  const lastHighlightedHex = highlightedHexes[highlightedHexes.length - 1];

  return (
    <>
      {lastHighlightedHex && (
        <group position={[lastHighlightedHex.pos[0], 0.32, lastHighlightedHex.pos[1]]}>
          <BaseThreeTooltip position={"-left-1/2 -mt-[150px]"} distanceFactor={30} className="animate-bounce">
            <div className="">info</div>
          </BaseThreeTooltip>
        </group>
      )}
    </>
  );
};
