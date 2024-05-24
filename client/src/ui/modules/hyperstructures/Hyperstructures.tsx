import { useDojo } from "@/hooks/context/DojoContext";
import { hyperstructures } from "../../components/navigation/Config";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { EntityList } from "@/ui/components/list/EntityList";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { ViewOnMapButton } from "@/ui/components/military/ArmyManagementCard";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export const HyperStructures = ({}: any) => {
  const hyperstructures = useHyperstructures();

  const viewOnMapButton = (entityId: any) => {
    // const position = getComponentValue(useDojo().setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]));
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === BigInt(entityId));
    if (!hyperstructure) return null;
    const progress = hyperstructure.progress.reduce((acc, progress) => acc + progress.amount, 0);
    return (
      <div className="flex space-x-2 items-center">
        <span className="text-lg font-semibold">{progress}</span>
        <ViewOnMapButton
          position={{
            x: hyperstructure.x!,
            y: hyperstructure.y!,
          }}
        />
      </div>
    );
  };
  return (
    <>
      <EntityList
        title="Hyperstructures"
        panel={({ entity }) => <HyperstructurePanel entity={entity} />}
        entityContent={viewOnMapButton}
        list={hyperstructures.map((hyperstructure) => ({
          id: hyperstructure.entity_id,
          name: `Hyperstructure ${hyperstructure.entity_id}`,
          ...hyperstructure,
        }))}
      />
    </>
  );
};
