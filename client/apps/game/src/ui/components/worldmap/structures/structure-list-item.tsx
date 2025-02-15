import { TroopChip } from "@/ui/components/military/troop-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { RealmResourcesIO } from "@/ui/components/resources/realm-resources-io";
import { ArmyInfo, Structure, StructureType } from "@bibliothecadao/eternum";
import { useGetHyperstructureProgress } from "@bibliothecadao/react";

type StructureListItemProps = {
  structure: Structure;
  setShowMergeTroopsPopup: (show: boolean) => void;
  ownArmySelected: ArmyInfo | undefined;
  maxInventory?: number;
  showButtons?: boolean;
};

const immuneTooltipContent = (
  <>
    This structure is currently immune to attacks.
    <br />
    During this period, you are also unable to attack other players.
  </>
);

export const StructureListItem = ({
  structure,
  setShowMergeTroopsPopup,
  ownArmySelected,
  maxInventory = Infinity,
  showButtons = false,
}: StructureListItemProps) => {
  const getHyperstructureProgress = useGetHyperstructureProgress();

  const progress =
    structure.category === StructureType[StructureType.Hyperstructure]
      ? getHyperstructureProgress(structure.entity_id)
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
            <div className="h4 text-xl flex flex-row justify-between ">
              <div className="mr-2 text-base">{structure.name}</div>
            </div>
            {structure.category === StructureType[StructureType.Hyperstructure] && (
              <div className="text-xs">Progress: {progress?.percentage ?? 0}%</div>
            )}

            {structure.category === StructureType[StructureType.Realm] && (
              <RealmResourcesIO realmEntityId={structure.entity_id} />
            )}
          </div>
          <div className="flex flex-col content-center w-[55%]">
            {structure.protector && <TroopChip troops={structure.protector?.troops} />}
            <InventoryResources
              max={maxInventory}
              entityId={structure.entity_id}
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
