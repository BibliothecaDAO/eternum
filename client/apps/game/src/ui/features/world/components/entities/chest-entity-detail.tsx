import { ID } from "@bibliothecadao/types";
import { memo } from "react";

interface ChestEntityDetailProps {
  chestEntityId: ID;
  compact?: boolean;
}

export const ChestEntityDetail = memo(({ chestEntityId, compact = false }: ChestEntityDetailProps) => {
  if (compact) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="text-gold font-bold">Chest</div>
        <div className="text-xs text-gray-300">ID: #{chestEntityId}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="text-gold font-bold text-lg">Treasure Chest</div>
      <div className="text-sm text-gray-300">
        <div>Entity ID: #{chestEntityId}</div>
        <div className="text-xs text-gray-400 mt-1">Click to open the chest and claim rewards</div>
      </div>
    </div>
  );
});

ChestEntityDetail.displayName = "ChestEntityDetail";