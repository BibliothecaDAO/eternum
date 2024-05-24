import { useDojo } from "@/hooks/context/DojoContext";
import { hyperstructures } from "../../components/navigation/Config";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { EntityList } from "@/ui/components/list/EntityList";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { ViewOnMapButton } from "@/ui/components/military/ArmyManagementCard";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import useRealmStore from "@/hooks/store/useRealmStore";

export const HyperStructures = ({}: any) => {
  const { hyperstructures } = useHyperstructures();

  const extraContent = (entityId: any) => {
    // const position = getComponentValue(useDojo().setup.components.Position, getEntityIdFromKeys([BigInt(entityId)]));
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === BigInt(entityId));
    if (!hyperstructure) return null;
    return (
      <HyperStructureExtraContent
        hyperstructureEntityId={hyperstructure.entity_id!}
        x={hyperstructure.x!}
        y={hyperstructure.y!}
      />
    );
  };
  return (
    <>
      <EntityList
        title="Hyperstructures"
        panel={({ entity }) => <HyperstructurePanel entity={entity} />}
        entityContent={extraContent}
        list={hyperstructures.map((hyperstructure) => ({
          id: hyperstructure.entity_id,
          name: `Hyperstructure ${hyperstructure.entity_id}`,
          ...hyperstructure,
        }))}
      />
    </>
  );
};

const HyperStructureExtraContent = ({
  hyperstructureEntityId,
  x,
  y,
}: {
  hyperstructureEntityId: bigint;
  x: number;
  y: number;
}) => {
  const { useProgress } = useHyperstructures();
  const progress = useProgress(hyperstructureEntityId);
  return (
    <div className="flex space-x-10 items-center">
      <span className="text-lg font-semibold"></span>
      <ViewOnMapButton
        position={{
          x: x,
          y: y,
        }}
      />
      <div>Progress: {`${progress.pourcentage}%`}</div>
    </div>
  );
};
