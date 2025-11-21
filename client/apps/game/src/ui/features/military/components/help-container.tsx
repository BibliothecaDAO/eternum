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
    <div className="space-y-4">
      <div className="rounded-xl border border-gold/25 bg-dark-brown/60 shadow-lg overflow-hidden">
        <div className="flex border-b border-gold/20 bg-dark-brown/70">
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide border-b-2 transition-all duration-200 ${
              transferType === TransferType.Troops
                ? "text-gold border-gold bg-gold/10"
                : "text-gold/60 border-transparent hover:text-gold/90 hover:bg-gold/5"
            }`}
            onClick={() => setTransferType(TransferType.Troops)}
          >
            <span>⚔️</span>
            <span>Transfer Troops</span>
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide border-b-2 transition-all duration-200 ${
              transferType === TransferType.Relics
                ? "text-gold border-gold bg-gold/10"
                : "text-gold/60 border-transparent hover:text-gold/90 hover:bg-gold/5"
            }`}
            onClick={() => setTransferType(TransferType.Relics)}
          >
            <span>💰</span>
            <span>Transfer Relics</span>
          </button>
        </div>

        <div className="bg-dark-brown/40">
          <div className="max-h-[70vh] overflow-y-auto p-4">
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
    </div>
  );
};
