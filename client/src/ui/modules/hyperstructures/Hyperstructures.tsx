import { useDojo } from "@/hooks/context/DojoContext";
import { hyperstructures } from "../../components/navigation/Config";
import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { EntityList } from "@/ui/components/list/EntityList";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, HasValue } from "@dojoengine/recs";
import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";

export const HyperStructures = ({}: any) => {
  const {
    setup: {
      components: { Structure },
    },
  } = useDojo();

  const hyperstructures = useHyperstructures();
  return (
    <>
      <EntityList
        title="Hyperstructures"
        panel={({ entity }) => <HyperstructurePanel entity={entity} />}
        list={hyperstructures.map((hyperstructure) => ({
          id: hyperstructure.entity_id,
          name: `Hyperstructure ${hyperstructure.entity_id}`,
          ...hyperstructure,
        }))}
      />
    </>
  );
};
