import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { RealmResourcesIO } from "@/ui/components/resources/realm-resources-io";
import { getHyperstructureProgress, getStructureTypeName } from "@bibliothecadao/eternum";
import { useDojo, useGuardsByStructure } from "@bibliothecadao/react";
import { Structure, StructureType } from "@bibliothecadao/types";
import { CompactDefenseDisplay } from "../../military/compact-defense-display";

type StructureListItemProps = {
  structure: Structure;
  maxInventory?: number;
  showButtons?: boolean;
  compact?: boolean;
};

export const StructureListItem = ({
  structure,
  maxInventory = Infinity,
  showButtons = false,
  compact = false,
}: StructureListItemProps) => {
  const {
    setup: { components },
  } = useDojo();

  const guards = useGuardsByStructure({ structureEntityId: structure.entityId }).filter(
    (guard) => guard.troops.count > 0n,
  );

  const isRealm = structure.structure.base.category === StructureType.Realm;
  const isHyperstructure = structure.structure.base.category === StructureType.Hyperstructure;
  const structureTypeName = isRealm ? structure.name : getStructureTypeName(structure.structure.category);
  const progress = isHyperstructure ? getHyperstructureProgress(structure.entityId, components) : undefined;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-col w-full gap-2">
        {/* Top section - Structure info */}
        <div className="flex flex-col w-full gap-2">
          {/* Structure info */}
          <div className="flex flex-col justify-between gap-1">
            {/* Type and name */}
            <div className="flex flex-col gap-0.5">
              <div className="bg-gold/10 rounded-sm px-2 py-0.5 border-l-4 border-gold">
                <h6 className={`${compact ? "text-xs" : "text-base"} font-bold truncate`}>{structure.name}</h6>
              </div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gold/90 uppercase tracking-wide`}>
                {structureTypeName}
              </div>
            </div>

            {/* Progress bar for hyperstructures */}
            {isHyperstructure && (
              <div className="flex flex-col gap-1 mt-1 bg-gray-800/40 rounded p-2 border border-gold/20">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold text-gold/90 uppercase">Construction Progress</div>
                  <div className="text-xs font-semibold bg-gold/20 px-2 py-0.5 rounded-full">
                    {progress?.percentage ?? 0}%
                  </div>
                </div>
                <div className="w-full bg-gray-700/70 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-gold/80 to-gold h-full rounded-full transition-all duration-500 shadow-glow-sm"
                    style={{ width: `${progress?.percentage ?? 0}%` }}
                  />
                </div>
                {progress?.percentage !== 100 && (
                  <div className="text-xxs text-gold/60 italic text-center mt-0.5">
                    {progress?.percentage === 0 ? "Construction not started" : "Construction in progress"}
                  </div>
                )}
              </div>
            )}

            {/* Realm resources input/output display */}
            {isRealm && (
              <div className="mt-0.5">
                <RealmResourcesIO realmEntityId={structure.entityId} compact={true} size="xs" />
              </div>
            )}
          </div>

          {/* Guards/Defense section - full width */}
          {guards.length > 0 && (
            <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
              <div className={`${compact ? "text-xxs" : "text-xs"} text-gold/80 uppercase font-semibold`}>Defense</div>
              <CompactDefenseDisplay
                troops={guards.map((army) => ({
                  slot: army.slot,
                  troops: army.troops,
                }))}
              />
            </div>
          )}
        </div>

        {/* Bottom section - Resources (full width) */}
        <div className="flex flex-col gap-0.5 w-full mt-1 border-t border-gold/20 pt-1">
          <div className={`${compact ? "text-xxs" : "text-xs"} text-gold/80 uppercase font-semibold`}>Resources</div>
          <InventoryResources
            max={maxInventory}
            entityId={structure.entityId}
            className="flex flex-wrap gap-1 w-full no-scrollbar"
            resourcesIconSize="xs"
            textSize="xxs"
          />
        </div>
      </div>

      {/* Action buttons */}
      {showButtons && <div className="flex justify-end gap-1 mt-0.5">{showButtons}</div>}
    </div>
  );
};
