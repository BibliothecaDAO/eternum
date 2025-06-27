import { useDojo } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { useState } from "react";
import Button from "@/ui/design-system/atoms/button";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";

export const ChestContainer = ({
  explorerEntityId,
  chestHex,
}: {
  explorerEntityId: ID;
  chestHex: { x: number; y: number };
}) => {
  const [isOpening, setIsOpening] = useState(false);
  const [openResult, setOpenResult] = useState<any>(null);
  const {
    setup: { systemCalls },
    account: { account },
  } = useDojo();

  const handleOpenChest = async () => {
    if (!account) return;

    setIsOpening(true);
    try {
      const result = await systemCalls.open_chest({
        signer: account,
        explorer_id: explorerEntityId,
        chest_coord: {
          x: chestHex.x,
          y: chestHex.y,
        },
      });
      setOpenResult(result);
    } catch (error) {
      console.error("Failed to open chest:", error);
    } finally {
      setIsOpening(false);
    }
  };

  if (isOpening) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <LoadingAnimation />
        <p className="text-gold mt-4">Opening relic chest...</p>
      </div>
    );
  }

  if (openResult) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-green text-xl mb-4">🎉 Chest Opened Successfully!</div>
        <p className="text-gold">Relics have been added to your explorer's inventory.</p>
        <p className="text-gold/70 text-sm mt-2">Check your explorer's resources to see the new relics.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="text-gold text-xl mb-4">📦 Relic Chest</div>
      <p className="text-gold/80 mb-6 text-center max-w-md">
        This chest contains valuable relics that can enhance your structures and armies. 
        Opening it will add the relics to your explorer's inventory.
      </p>
      
      <div className="mb-6">
        <p className="text-gold/60 text-sm">Explorer: #{explorerEntityId}</p>
        <p className="text-gold/60 text-sm">Chest Location: ({chestHex.x}, {chestHex.y})</p>
      </div>

      <Button 
        onClick={handleOpenChest}
        className="bg-gold text-black hover:bg-gold/80 px-6 py-3"
        disabled={isOpening}
      >
        Open Chest
      </Button>
    </div>
  );
};