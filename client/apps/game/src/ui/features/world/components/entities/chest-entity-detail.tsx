import { getCrateName } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types";
import { memo } from "react";

interface ChestEntityDetailProps {
  chestEntityId: ID;
  compact?: boolean;
}

export const ChestEntityDetail = memo(({ chestEntityId, compact = false }: ChestEntityDetailProps) => {
  const chestName = getCrateName(chestEntityId);

  if (compact) {
    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="text-gold font-bold">{chestName}</div>
        <div className="text-xs ">ID: #{chestEntityId}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <div className="text-gold font-bold text-lg">{chestName}</div>
      <div className="text-sm ">
        <div>Crate ID: #{chestEntityId}</div>
        <div className="text-xs  mt-1">Click to open the crate and claim rewards</div>
      </div>
    </div>
  );
});

ChestEntityDetail.displayName = "ChestEntityDetail";
