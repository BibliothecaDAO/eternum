import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyWarning } from "@/ui/components/worldmap/armies/army-warning";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { ArmyInfo } from "@bibliothecadao/types";
import { memo } from "react";
import { TroopChip } from "../../military/troop-chip";

export interface ArmyEntityDetailProps {
  army: ArmyInfo;
  playerGuild?: { name: string } | null;
  availableResources?: Array<{ resourceId: number; amount: number }>;
  originRealmName?: string | null;
  className?: string;
  compact?: boolean;
}

export const ArmyEntityDetail = memo(
  ({
    army,
    playerGuild,
    availableResources = [],
    originRealmName,
    className,
    compact = false,
  }: ArmyEntityDetailProps) => {
    return (
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-2"} ${className}`}>
        {/* Header with owner and warnings */}
        <div className={`flex items-center justify-between border-b border-gold/30 ${compact ? "pb-1" : "pb-2"} gap-2`}>
          <div className="flex flex-col">
            <h4 className={`${compact ? "text-base" : "text-lg"} font-bold`}>{army.ownerName || army.name}</h4>
            {playerGuild && (
              <div className="text-xs text-gold/80">
                {"< "}
                {playerGuild.name}
                {" >"}
              </div>
            )}
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold ${army.isMine ? "bg-green/20" : "bg-red/20"}`}>
            {army.isMine ? "Ally" : "Enemy"}
          </div>
        </div>

        {/* Realm origin - made more prominent */}
        {originRealmName && (
          <div className={`bg-gold/10 rounded-sm ${compact ? "px-2 py-0.5" : "px-3"} border-l-4 border-gold`}>
            <h6 className={`${compact ? "text-sm" : "text-base"} font-bold`}>{originRealmName}</h6>
          </div>
        )}

        {/* Army warnings */}
        <ArmyWarning army={army} />

        {/* Army information section */}
        <div className="flex justify-between items-start">
          {/* Army name and status */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center w-full">
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold truncate mr-2`}>
                {army.name}
              </div>
            </div>
            {army.isHome && <div className="text-xs text-green mt-1">At Base</div>}
          </div>

          {/* Resources and capacity */}
          <div className="flex flex-col items-end">
            {army.isMercenary && <div className="text-xs text-orange mt-1">Mercenary</div>}
          </div>
        </div>

        {/* Stamina and capacity - more prominent */}
        <div
          className={`flex flex-col ${compact ? "gap-1" : "gap-2"} bg-gray-900/40 rounded ${compact ? "p-1.5" : "p-2"} border border-gold/20`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className={`${compact ? "text-xxs" : "text-xs"} font-bold text-gold/90`}>STAMINA</div>
            <StaminaResource entityId={army.entityId} />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className={`${compact ? "text-xxs" : "text-xs"} font-bold text-gold/90`}>CAPACITY</div>
            <ArmyCapacity army={army} />
          </div>
        </div>

        {/* Resources section */}
        {availableResources.length > 0 && (
          <div className={`${compact ? "mt-0.5" : "mt-1"} border-t border-gold/30 ${compact ? "pt-1" : "pt-2"}`}>
            <div className={`${compact ? "text-xxs" : "text-xs"} uppercase font-bold text-gold/80 mb-1`}>Resources</div>
            {/* Using InventoryResources component for resource display */}
            <InventoryResources
              entityId={army.entityId}
              max={compact ? 5 : 12}
              className="flex flex-wrap gap-1 no-scrollbar"
              resourcesIconSize={compact ? "xs" : "sm"}
              textSize={compact ? "xxs" : "xs"}
            />
          </div>
        )}

        {/* Troops section */}
        <div className={`${compact ? "mt-0.5" : "mt-1"} border-t border-gold/30 ${compact ? "pt-1" : "pt-2"}`}>
          <div className={`${compact ? "text-xxs" : "text-xs"} uppercase font-bold text-gold/80 mb-1`}>
            Army Composition
          </div>
          <TroopChip troops={army.troops} iconSize={compact ? "md" : "lg"} />
        </div>
      </div>
    );
  },
);

ArmyEntityDetail.displayName = "ArmyEntityDetail";
