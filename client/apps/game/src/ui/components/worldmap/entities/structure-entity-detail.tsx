import { StructureListItem } from "@/ui/components/worldmap/structures/structure-list-item";
import { Structure } from "@bibliothecadao/types";
import { memo } from "react";
import { ImmunityTimer } from "../structures/immunity-timer";

export interface StructureEntityDetailProps {
  structure: Structure;
  playerGuild?: { name: string } | null;
  className?: string;
  compact?: boolean;
  maxInventory?: number;
  showButtons?: boolean;
}

export const StructureEntityDetail = memo(
  ({
    structure,
    playerGuild,
    className,
    compact = false,
    maxInventory = Infinity,
    showButtons = false,
  }: StructureEntityDetailProps) => {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <div className="flex items-center justify-between border-b border-gold/30 pb-2 gap-2">
          <div className="flex flex-col">
            <h4 className="text-lg font-bold">{structure.ownerName}</h4>
            {playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold ${structure.isMine ? "bg-green/20" : "bg-red/20"}`}>
            {structure.isMine ? "Ally" : "Enemy"}
          </div>
        </div>
        <StructureListItem
          structure={structure}
          maxInventory={maxInventory}
          showButtons={showButtons}
          compact={compact}
        />
        <div className="mt-2">
          <ImmunityTimer structure={structure} />
        </div>
      </div>
    );
  },
);

StructureEntityDetail.displayName = "StructureEntityDetail";
