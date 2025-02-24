import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { ArmyChip } from "@/ui/components/military/army-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { HexPosition } from "@bibliothecadao/eternum";
import { usePlayerArmyAtPosition, useQuery } from "@bibliothecadao/react";
import { useEffect } from "react";
import { ArmyWarning } from "./army-warning";

export const SelectedArmy = () => {
  const { isMapView } = useQuery();

  const selectedHex = useUIStore((state) => state.selectedHex);

  if (!selectedHex || !isMapView) return null;

  return <SelectedArmyContent selectedHex={selectedHex} />;
};

const SelectedArmyContent = ({ selectedHex }: { selectedHex: HexPosition }) => {
  const updateSelectedEntityId = useUIStore((state) => state.updateSelectedEntityId);

  useEffect(() => {
    if (!selectedHex) updateSelectedEntityId(null);
  }, [selectedHex, updateSelectedEntityId]);

  const playerArmy = usePlayerArmyAtPosition({
    position: new Position({ x: selectedHex?.col || 0, y: selectedHex?.row || 0 }).getContract(),
  });

  useEffect(() => {
    if (selectedHex) {
      updateSelectedEntityId(playerArmy?.entityId || 0);
    }
  }, [playerArmy]);

  if (!playerArmy) return null;

  return (
    <div
      className={`
        fixed left-1/2 transform -translate-x-1/2
        bg-black/80 p-2 rounded-lg
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        bottom-0 opacity-100
      `}
    >
      <div className="flex flex-col gap-2 w-[27rem]">
        <ArmyWarning army={playerArmy} />
        <ArmyChip className="bg-black/90" army={playerArmy} showButtons={false} />
        <InventoryResources
          entityId={playerArmy.entityId}
          className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
          resourcesIconSize="xs"
        />
      </div>
    </div>
  );
};
