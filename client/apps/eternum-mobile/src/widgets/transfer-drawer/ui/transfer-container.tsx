import { Button } from "@/shared/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useStore } from "@/shared/store";
import { ActorType } from "@bibliothecadao/types";
import { useState } from "react";
import { 
  TransferDirection, 
  TransferType, 
  TransferEntity, 
  getActorTypes 
} from "../model/types";
import { TransferResourcesContainer } from "./transfer-resources-container";
import { TransferTroopsContainer } from "./transfer-troops-container";
import { ArrowLeftRight } from "lucide-react";

interface TransferContainerProps {
  selected: TransferEntity;
  target: TransferEntity;
  allowBothDirections?: boolean;
}

export const TransferContainer = ({
  selected,
  target,
  allowBothDirections = false,
}: TransferContainerProps) => {
  const { closeTransferDrawer } = useStore((state) => ({
    closeTransferDrawer: state.closeTransferDrawer,
  }));

  const [transferType, setTransferType] = useState<TransferType>(TransferType.Resources);
  const [swapped, setSwapped] = useState<boolean>(false);

  // Get the current entities we're working with based on swap state
  const currentSelected = swapped ? target : selected;
  const currentTarget = swapped ? selected : target;

  // Determine the transfer direction based on entity types
  const transferDirection = (() => {
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

  // Handle transfer completion
  const handleTransferComplete = () => {
    closeTransferDrawer();
  };

  // Handle swapping selected and target entities
  const handleSwapEntities = () => {
    setSwapped(!swapped);
  };

  // Render transfer direction options
  const renderTransferDirectionOptions = () => {
    return (
      <div className="flex flex-col space-y-3 mb-4 p-4 bg-white/5 rounded-md">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gold">Transfer Direction</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 flex-1">
            <div className="px-4 py-2 rounded-md bg-primary/20 border border-primary/40 text-sm">
              {transferDirection === TransferDirection.ExplorerToStructure
                ? "Explorer → Structure"
                : transferDirection === TransferDirection.StructureToExplorer
                  ? "Structure → Explorer"
                  : "Explorer → Explorer"}
            </div>
            {allowBothDirections && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwapEntities}
                className="flex items-center gap-1"
              >
                <ArrowLeftRight size={14} />
                Swap
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Transfer Type Selection */}
      <Tabs
        value={transferType.toString()}
        onValueChange={(value) => setTransferType(parseInt(value) as TransferType)}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value={TransferType.Resources.toString()} className="flex items-center gap-2">
            💰 Resources
          </TabsTrigger>
          <TabsTrigger value={TransferType.Troops.toString()} className="flex items-center gap-2">
            ⚔️ Troops
          </TabsTrigger>
        </TabsList>

        {/* Transfer Type Description */}
        <div className="text-center mb-4 px-4 py-2 bg-white/5 rounded-md">
          <p className="text-sm text-muted-foreground">
            {transferType === TransferType.Resources
              ? "Transfer resources between your explorers and structures."
              : "Transfer troops between your explorers and structures."}
          </p>
        </div>

        {/* Transfer Direction Selection */}
        {renderTransferDirectionOptions()}

        {/* Transfer Content */}
        <TabsContent value={TransferType.Resources.toString()}>
          <TransferResourcesContainer
            selectedEntityId={currentSelected.id}
            targetEntityId={currentTarget.id}
            transferDirection={transferDirection}
            onTransferComplete={handleTransferComplete}
          />
        </TabsContent>

        <TabsContent value={TransferType.Troops.toString()}>
          <TransferTroopsContainer
            selectedEntityId={currentSelected.id}
            targetEntityId={currentTarget.id}
            selectedHex={currentSelected.hex}
            targetHex={currentTarget.hex}
            transferDirection={transferDirection}
            onTransferComplete={handleTransferComplete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};