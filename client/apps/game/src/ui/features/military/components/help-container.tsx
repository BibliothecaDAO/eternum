import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActorType, ID } from "@bibliothecadao/types";
import { useEffect, useState } from "react";
import { TransferResourcesContainer } from "./transfer-resources-container";
import { TransferTroopsContainer } from "./transfer-troops-container";

export enum TransferDirection {
  ExplorerToStructure,
  StructureToExplorer,
  ExplorerToExplorer,
}

export const getActorTypes = (direction: TransferDirection) => {
  if (direction === TransferDirection.ExplorerToStructure) {
    return { selected: ActorType.Explorer, target: ActorType.Structure };
  } else if (direction === TransferDirection.StructureToExplorer) {
    return { selected: ActorType.Structure, target: ActorType.Explorer };
  } else {
    return { selected: ActorType.Explorer, target: ActorType.Explorer };
  }
};

enum TransferType {
  Relics,
  Troops,
}

export const HelpContainer = ({
  selected,
  target,
  allowBothDirections = false,
}: {
  selected: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: ActorType;
    id: ID;
    hex: { x: number; y: number };
  };
  allowBothDirections?: boolean;
}) => {
  const [transferType, setTransferType] = useState<TransferType>(TransferType.Troops);
  const [swapped, setSwapped] = useState<boolean>(false);

  useEffect(() => {
    if (transferType === TransferType.Relics) {
      setSwapped(false);
    }
  }, [transferType]);

  const updateSelectedEntityId = useUIStore((state) => state.updateEntityActionSelectedEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);

  // Get the current entities we're working with based on direction state
  const baseSelected = swapped ? target : selected;
  const baseTarget = swapped ? selected : target;
  const explorerEntity =
    selected.type === ActorType.Explorer ? selected : target.type === ActorType.Explorer ? target : null;
  const structureEntity =
    selected.type === ActorType.Structure ? selected : target.type === ActorType.Structure ? target : null;
  const currentSelected = transferType === TransferType.Relics && explorerEntity ? explorerEntity : baseSelected;
  const currentTarget = transferType === TransferType.Relics && structureEntity ? structureEntity : baseTarget;

  // Determine the transfer direction based on entity types
  const derivedTransferDirection = (() => {
    if (currentSelected.type === ActorType.Explorer && currentTarget.type === ActorType.Structure) {
      return TransferDirection.ExplorerToStructure;
    }

    if (currentSelected.type === ActorType.Structure && currentTarget.type === ActorType.Explorer) {
      return TransferDirection.StructureToExplorer;
    }

    if (currentSelected.type === ActorType.Explorer && currentTarget.type === ActorType.Explorer) {
      return TransferDirection.ExplorerToExplorer;
    }

    return TransferDirection.ExplorerToStructure;
  })();

  const transferDirection = derivedTransferDirection;

  // Handle transfer completion
  const handleTransferComplete = () => {
    updateSelectedEntityId(null);
    toggleModal(null);
  };

  // Handle toggling transfer direction when both entities support it
  const handleToggleDirection = () => {
    if (!allowBothDirections || transferType === TransferType.Relics) {
      return;
    }

    setSwapped((previous) => !previous);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center mx-auto mb-4">
      <div className="px-6 h-full backdrop-blur-sm w-full flex flex-col">
        {/* Transfer Type Selection */}
        <div className="flex justify-center mb-6 mx-auto mt-4">
          <div className="flex rounded-md overflow-hidden border border-gold/30 shadow-lg">
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
            <button
              className={`px-8 py-3 text-lg font-semibold transition-all duration-200 ${
                transferType === TransferType.Relics
                  ? "bg-gold/20 text-gold border-b-2 border-gold"
                  : "bg-dark-brown text-gold/70 hover:text-gold hover:bg-brown-900/50"
              }`}
              onClick={() => setTransferType(TransferType.Relics)}
            >
              <div className="flex items-center">
                <span className="mr-2">💰</span>
                Transfer Relics
              </div>
            </button>
          </div>
        </div>

        {/* Transfer Content - Use flex-grow to fill available space */}
        <div className="flex-grow overflow-y-auto">
          {transferType === TransferType.Relics ? (
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
              onToggleDirection={handleToggleDirection}
              canToggleDirection={allowBothDirections}
            />
          )}
        </div>
      </div>
    </div>
  );
};
