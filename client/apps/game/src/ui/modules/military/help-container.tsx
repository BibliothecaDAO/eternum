import { useUIStore } from "@/hooks/store/use-ui-store";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useState } from "react";
import { TransferResourcesContainer } from "./transfer-resources-container";
import { TransferDirection, TransferTroopsContainer } from "./transfer-troops-container";

enum TransferType {
  Resources,
  Troops,
}

export const HelpContainer = ({
  selectedEntityId,
  targetHex,
}: {
  selectedEntityId: ID;
  targetHex: { x: number; y: number };
}) => {
  const {
    setup: {
      components: { Tile },
    },
  } = useDojo();

  const [transferType, setTransferType] = useState<TransferType>(TransferType.Resources);

  const selectedHex = useUIStore((state) => state.selectedHex);
  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // Determine if the selected entity is a structure or an explorer
  const selectedEntityType = (() => {
    const tile = getComponentValue(
      Tile,
      getEntityIdFromKeys([BigInt(selectedHex?.col || 0), BigInt(selectedHex?.row || 0)]),
    );
    return tile?.occupier_is_structure ? "structure" : "explorer";
  })();

  // Determine if the target entity is a structure or an explorer
  const targetEntityType = (() => {
    const targetTile = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
    if (!targetTile || !targetTile.occupier_id) return null;
    return targetTile.occupier_is_structure ? "structure" : "explorer";
  })();

  // Get the target entity ID
  const targetEntityId = (() => {
    const targetTile = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
    return targetTile?.occupier_id || 0;
  })();

  // Determine available transfer directions based on entity types
  const availableTransferDirections = (() => {
    if (!selectedEntityType || !targetEntityType) return [];

    const directions: TransferDirection[] = [];

    if (selectedEntityType === "explorer" && targetEntityType === "structure") {
      directions.push(TransferDirection.ExplorerToStructure);
    }

    if (selectedEntityType === "structure" && targetEntityType === "explorer") {
      directions.push(TransferDirection.StructureToExplorer);
    }

    if (selectedEntityType === "explorer" && targetEntityType === "explorer") {
      directions.push(TransferDirection.ExplorerToExplorer);
    }

    return directions;
  })();

  // Set default transfer direction
  const [transferDirection, setTransferDirection] = useState<TransferDirection>(
    availableTransferDirections[0] || TransferDirection.ExplorerToStructure,
  );

  // Handle transfer completion
  const handleTransferComplete = () => {
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  // Render transfer direction options
  const renderTransferDirectionOptions = () => {
    return (
      <div className="flex flex-col space-y-2 mb-4">
        <label className="text-gold font-semibold">Transfer Direction:</label>
        <div className="flex flex-wrap gap-2">
          {availableTransferDirections.map((direction) => (
            <button
              key={direction}
              className={`px-4 py-2 rounded-md border ${
                transferDirection === direction
                  ? "bg-gold/20 border-gold"
                  : "bg-dark-brown border-gold/30 hover:border-gold/50"
              }`}
              onClick={() => setTransferDirection(direction)}
            >
              {direction === TransferDirection.ExplorerToStructure && "Explorer → Structure"}
              {direction === TransferDirection.StructureToExplorer && "Structure → Explorer"}
              {direction === TransferDirection.ExplorerToExplorer && "Explorer → Explorer"}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Convert selectedHex to the correct format
  const formattedSelectedHex = selectedHex ? { x: selectedHex.col, y: selectedHex.row } : null;

  return (
    <div className="flex h-full flex-col items-center justify-center  max-w-4xl mx-auto">
      <div className="px-6 h-full border-gold/20 rounded-lg bg-dark-brown/90 backdrop-blur-sm w-full flex flex-col">
        {/* Transfer Type Selection */}
        <div className="flex justify-center mb-6 mx-auto mt-4">
          <div className="flex rounded-md overflow-hidden border border-gold/30 shadow-lg">
            <button
              className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                transferType === TransferType.Resources
                  ? "bg-gold/20 text-gold border-b-2 border-gold"
                  : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
              }`}
              onClick={() => setTransferType(TransferType.Resources)}
            >
              <div className="flex items-center">
                <span className="mr-2">💰</span>
                Transfer Resources
              </div>
            </button>
            <button
              className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                transferType === TransferType.Troops
                  ? "bg-gold/20 text-gold border-b-2 border-gold"
                  : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
              }`}
              onClick={() => setTransferType(TransferType.Troops)}
            >
              <div className="flex items-center">
                <span className="mr-2">⚔️</span>
                Transfer Troops
              </div>
            </button>
          </div>
        </div>

        {/* Transfer Type Description */}
        <div className="text-center mb-4 px-6">
          <p className="text-gold/70 text-sm">
            {transferType === TransferType.Resources
              ? "Transfer resources between your explorers and structures."
              : "Transfer troops between your explorers and structures."}
          </p>
        </div>

        {/* Transfer Direction Selection */}
        {renderTransferDirectionOptions()}

        {/* Transfer Content - Use flex-grow to fill available space */}
        <div className="flex-grow overflow-y-auto">
          {transferType === TransferType.Resources ? (
            <TransferResourcesContainer
              selectedEntityId={selectedEntityId}
              targetEntityId={targetEntityId}
              transferDirection={transferDirection}
              onTransferComplete={handleTransferComplete}
            />
          ) : (
            formattedSelectedHex && (
              <TransferTroopsContainer
                selectedEntityId={selectedEntityId}
                targetEntityId={targetEntityId}
                selectedHex={formattedSelectedHex}
                targetHex={targetHex}
                transferDirection={transferDirection}
                onTransferComplete={handleTransferComplete}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};
