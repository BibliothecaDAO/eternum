import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { HintSection } from "@/ui/components/hints/HintModal";
import { EntityList } from "@/ui/components/list/EntityList";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { ID } from "@bibliothecadao/eternum";

export const Military = ({ entityId }: { entityId: ID | undefined }) => {
  const { playerStructures } = useEntities();

  const { isMapView } = useQuery();

  return (
    <div className="relative">
      <div className="flex justify-end">
        <HintModalButton className="relative top-1 right-1" section={HintSection.Combat} />
      </div>
      {isMapView ? (
        <EntitiesArmyTable />
      ) : (
        <EntityList
          current={entityId}
          list={playerStructures()}
          title="armies"
          panel={({ entity }) => <ArmyPanel structure={entity} />}
        />
      )}
    </div>
  );
};
