import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { Structure } from "@/hooks/helpers/useStructures";
import { currencyIntlFormat } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  resources,
} from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { InventoryResources } from "../../resources/InventoryResources";

type StructureListItemProps = {
  structure: Structure;
  extraButton?: JSX.Element;
};

export const StructureListItem = ({ structure, extraButton }: StructureListItemProps) => {
  const { getRealmAddressName } = useRealm();
  const addressName = getRealmAddressName(BigInt(structure.entity_id));

  const { getHyperstructureProgress } = useHyperstructures();
  const progress = getHyperstructureProgress(BigInt(structure.entity_id));

  return (
    <div className="flex flex-col clip-angled-sm bg-gold/20 p-3">
      <div className=" h-30 p-1 border-gold w-full grid grid-cols-3 gap-2">
        <div className="text-center font-bold p-1 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse">
          {structure.name}
        </div>
        <div className=" h-30 text-center p-1 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="font-bold">Owner:</div> {addressName === "" ? "Bandits" : addressName}
        </div>
        <div className=" h-30 text-center p-1 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse flex flex-row justify-center items-center">
          {String(structure.category) === "FragmentMine" ? (
            <div className="font-bold">
              <ResourceIcon
                resource={resources.find((resource) => resource.id === ResourcesIds.Earthenshard)!.trait}
                className="inline mr-0.5"
                size="xs"
              />
              {currencyIntlFormat(
                RESOURCE_OUTPUTS_SCALED[ResourcesIds.Earthenshard] / EternumGlobalConfig.resources.resourcePrecision,
              )}
              /tick
            </div>
          ) : (
            <div className="font-bold">{HYPERSTRUCTURE_POINTS_PER_CYCLE} points/tick</div>
          )}
        </div>
        {String(structure.category) === "FragmentMine" && (
          <InventoryResources
            className="col-span-3 grid grid-cols-10 gap-1 hover:bg-crimson/40 h-30"
            entityId={BigInt(structure.entity_id)}
            dynamic={[ResourcesIds.Earthenshard]}
          />
        )}
      </div>
      <div className="flex items-end mt-2">
        <div className={clsx("flex items-center justify-around flex-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            {String(structure.category) === "Hyperstructure" && (
              <div className="uppercase w-full font-bold mb-1">Progress: {progress.percentage}%</div>
            )}
          </div>
        </div>
      </div>
      {extraButton || ""}
    </div>
  );
};
