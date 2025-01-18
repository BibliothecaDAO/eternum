import { useUIStore } from "@/hooks/store/use-ui-store";
import { ArmyChip } from "@/ui/components/military/army-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { Position, useArmiesAtPosition, useQuery } from "@bibliothecadao/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArmyWarning } from "./army-warning";

export const SelectedArmy = () => {
  const selectedHex = useUIStore((state) => state.selectedHex);
  const selectedEntityId = useUIStore((state) => state.armyActions.selectedEntityId);
  const updateSelectedEntityId = useUIStore((state) => state.updateSelectedEntityId);
  const { isMapView } = useQuery();

  const [selectedArmyIndex, setSelectedArmyIndex] = useState(0);

  useEffect(() => {
    if (!selectedHex) updateSelectedEntityId(null);
  }, [selectedHex, updateSelectedEntityId]);

  const armies = useArmiesAtPosition({
    position: new Position({ x: selectedHex?.col || 0, y: selectedHex?.row || 0 }).getContract(),
  });

  // player armies that are not in battle
  const playerArmies = useMemo(() => armies.filter((army) => army.isMine && army.battle_id === 0), [armies]);

  useEffect(() => {
    setSelectedArmyIndex(0);
  }, [playerArmies]);

  useEffect(() => {
    if (selectedHex) {
      updateSelectedEntityId(playerArmies[selectedArmyIndex]?.entity_id || 0);
    }
  }, [selectedArmyIndex, playerArmies, updateSelectedEntityId, selectedHex]);

  const ownArmy = useMemo(
    () => playerArmies.find((army) => army.entity_id === selectedEntityId),
    [playerArmies, selectedEntityId],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        setSelectedArmyIndex((prevIndex) => (prevIndex + 1) % playerArmies.length);
      }
    },
    [playerArmies.length],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const showTooltip = selectedHex && ownArmy && isMapView;

  return (
    <div
      className={`
        fixed left-1/2 transform -translate-x-1/2
        bg-black/80 p-2 rounded-lg
        transition-all duration-200 ease-in-out
        origin-bottom scale-75 md:scale-100
        ${showTooltip ? "bottom-0 opacity-100" : "translate-y-full opacity-0"}
      `}
    >
      {showTooltip && (
        <div>
          {playerArmies.length > 1 && (
            <div className="flex flex-row justify-between mt-2">
              <div className="px-2 py-1 text-sm rounded-tl animate-pulse">Press Tab to cycle through armies</div>
              <div className="px-2 py-1 text-sm rounded-bl ">
                Army {selectedArmyIndex + 1}/{playerArmies.length}
              </div>
            </div>
          )}
          <ArmyWarning army={ownArmy!} />
          <ArmyChip className="w-[27rem] bg-black/90" army={ownArmy} showButtons={false} />
          <InventoryResources
            entityId={ownArmy!.entity_id}
            className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
            resourcesIconSize="xs"
          />
        </div>
      )}
    </div>
  );
};
