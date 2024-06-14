import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { Headline } from "@/ui/elements/Headline";
import { RESOURCE_OUTPUTS_SCALED, ResourcesIds, StructureType, resources } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { InventoryResources } from "../../resources/InventoryResources";
import { Structure } from "@/hooks/helpers/useStructures";

type StructureListItemProps = {
  structure: Structure;
  onClick?: () => void;
  extraButton?: JSX.Element;
};

export const StructureListItem = ({ structure, onClick, extraButton }: StructureListItemProps) => {
  const { getRealmAddressName } = useRealm();
  const addressName = getRealmAddressName(BigInt(structure.entity_id));

  const { getHyperstructureProgress } = useHyperstructures();
  const progress = getHyperstructureProgress(BigInt(structure.entity_id));

  return (
    <div className="flex flex-col clip-angled-sm bg-gold/20 p-3">
      <div className="flex items-center p-1 border-gold font-bold w-full">
        <Headline className="text-gold">
          {StructureType[structure.category]} {structure.name}
        </Headline>
      </div>
      <div>Owned by {addressName}</div>
      <div className="flex items-end mt-2">
        <div className={clsx("flex items-center justify-around flex-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            {String(structure.category) === "ShardsMine" && (
              <div className="flex text-gold items-center">
                Produces {RESOURCE_OUTPUTS_SCALED[ResourcesIds.Earthenshard]}
                <ResourceIcon
                  resource={resources.find((resource) => resource.id === ResourcesIds.Earthenshard)!.trait}
                  className="inline mx-2"
                  size="xs"
                />{" "}
                / tick
              </div>
            )}
            {String(structure.category) === "Hyperstructure" && (
              <div className="uppercase w-full font-bold mb-1">{progress.percentage}%</div>
            )}
          </div>
        </div>
      </div>
      <InventoryResources entityId={BigInt(structure.entity_id)} title="Balance" />
      {extraButton || ""}
    </div>
  );
};
