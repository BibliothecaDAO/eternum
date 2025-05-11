import { useUIStore } from "@/hooks/store/use-ui-store";
import { ID } from "@bibliothecadao/types";
import { useState } from "react";
import { TransferResourcesContainer } from "./transfer-resources-container";
import { TransferDirection, TransferTroopsContainer } from "./transfer-troops-container";

enum TransferType {
  Resources,
  Troops,
}

export const HelpContainer = ({
  selected,
  target,
  allowBothDirections = false,
}: {
  selected: {
    type: "explorer" | "structure";
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: "explorer" | "structure";
    id: ID;
    hex: { x: number; y: number };
  };
  allowBothDirections?: boolean;
}) => {
  const [transferType, setTransferType] = useState<TransferType>(TransferType.Resources);
  const [swapped, setSwapped] = useState<boolean>(false);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // Get the current entities we're working with based on swap state
  const currentSelected = swapped ? target : selected;
  const currentTarget = swapped ? selected : target;

  // Determine the transfer direction based on entity types
  const transferDirection = (() => {
    if (currentSelected.type === "explorer" && currentTarget.type === "structure") {
      return TransferDirection.ExplorerToStructure;
    }

    if (currentSelected.type === "structure" && currentTarget.type === "explorer") {
      return TransferDirection.StructureToExplorer;
    }

    if (currentSelected.type === "explorer" && currentTarget.type === "explorer") {
      return TransferDirection.ExplorerToExplorer;
    }

    return TransferDirection.ExplorerToStructure;
  })();

  // Handle transfer completion
  const handleTransferComplete = () => {
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  // Handle swapping selected and target entities
  const handleSwapEntities = () => {
    setSwapped(!swapped);
  };

  // Render transfer direction options
  const renderTransferDirectionOptions = () => {
    return (
      <div className="flex flex-col space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <label className="text-gold font-semibold">Transfer Direction</label>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button className={`px-4 py-2 rounded-md border ${"bg-gold/20 border-gold"}`}>
              {transferDirection === TransferDirection.ExplorerToStructure
                ? "Explorer → Structure"
                : transferDirection === TransferDirection.StructureToExplorer
                  ? "Structure → Explorer"
                  : "Explorer → Explorer"}
            </button>
            {allowBothDirections && (
              <button
                className="flex items-center px-3 py-2 rounded-md border border-gold/30 hover:border-gold/50 bg-dark-brown text-gold/70 hover:text-gold"
                onClick={handleSwapEntities}
              >
                <span className="mr-1">🔄</span>
                Swap
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col items-center justify-center  max-w-4xl mx-auto">
      <div className="px-6 h-full backdrop-blur-sm w-full flex flex-col">
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
              selectedEntityId={currentSelected.id}
              targetEntityId={currentTarget.id}
              transferDirection={transferDirection}
              onTransferComplete={handleTransferComplete}
            />
          ) : (
            <TransferTroopsContainer
              selectedEntityId={currentSelected.id}
              targetEntityId={currentTarget.id}
              selectedHex={currentSelected.hex}
              targetHex={currentTarget.hex}
              transferDirection={transferDirection}
              onTransferComplete={handleTransferComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
};
