import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { RealmResourcesIO } from "@/ui/components/resources/realm-resources-io";
import { getStructureTypeName, Structure, StructureType } from "@bibliothecadao/eternum";
import { useGetHyperstructureProgress, useGuardsByStructure } from "@bibliothecadao/react";
import { CompactDefenseDisplay } from "../../military/compact-defense-display";

type StructureListItemProps = {
  structure: Structure;
  maxInventory?: number;
  showButtons?: boolean;
};

export const StructureListItem = ({
  structure,
  maxInventory = Infinity,
  showButtons = false,
}: StructureListItemProps) => {
  const getHyperstructureProgress = useGetHyperstructureProgress();

  const guards = useGuardsByStructure({ structureEntityId: structure.entityId }).filter(
    (guard) => guard.troops.count > 0n,
  );

  const isRealm = structure.structure.base.category === StructureType.Realm;

  const structureTypeName = isRealm ? structure.name : getStructureTypeName(structure.structure.category);

  const progress =
    structure.structure.base.category === StructureType.Hyperstructure
      ? getHyperstructureProgress(structure.entityId)
      : undefined;

  return (
    <div className="flex justify-between flex-row mt-2 ">
      <div
        className={`flex w-[27rem] h-full justify-between  ${
          structure.isMine ? "bg-blueish/20" : "bg-red/20"
        } rounded-md border-gold/20 p-2`}
      >
        <div className="flex w-full justify-between">
          <div className="flex flex-col w-[45%] justify-between">
            <div className="h4 text-xl flex flex-col">
              <div className="text-base font-semibold text-gold">{structureTypeName}</div>
              {!isRealm && <div className="text-sm text-gold/80">{structure.name}</div>}
            </div>
            {structure.structure.base.category === StructureType.Hyperstructure && (
              <div className="text-xs">Progress: {progress?.percentage ?? 0}%</div>
            )}

            {isRealm && <RealmResourcesIO realmEntityId={structure.entityId} />}
          </div>
          <div className="flex flex-col content-center w-[55%]">
            <CompactDefenseDisplay
              troops={guards.map((army) => ({
                slot: army.slot,
                troops: army.troops,
              }))}
            />
            <InventoryResources
              max={maxInventory}
              entityId={structure.entityId}
              className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
              resourcesIconSize="xs"
            />
          </div>
        </div>
      </div>
      {showButtons}
    </div>
  );
};
