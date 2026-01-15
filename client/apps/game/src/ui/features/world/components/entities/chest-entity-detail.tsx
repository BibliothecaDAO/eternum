import { memo } from "react";
import { ID } from "@bibliothecadao/types";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useChestEntityDetail } from "./hooks/use-chest-entity-detail";

export interface ChestEntityDetailProps {
  chestEntityId: ID;
  compact?: boolean;
  className?: string;
}

export const ChestEntityDetail = memo(({ chestEntityId, compact = false, className }: ChestEntityDetailProps) => {
  const { chestName } = useChestEntityDetail({ chestEntityId });

  if (compact) {
    return (
      <div className={cn("flex flex-col items-center space-y-1", className)}>
        <div className="font-bold text-gold">{chestName}</div>
        <div className="text-xs text-gold/80">ID: #{chestEntityId}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <div className="text-lg font-bold text-gold">{chestName}</div>
      <div className="text-sm text-gold/90">
        <div>Crate ID: #{chestEntityId}</div>
        <div className="mt-1 text-xs text-gold/70">Click to open the crate and claim rewards</div>
      </div>
    </div>
  );
});

ChestEntityDetail.displayName = "ChestEntityDetail";
