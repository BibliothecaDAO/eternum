import { useEntities } from "@/hooks/helpers/useEntities";
import { HintSection } from "@/ui/components/hints/HintModal";
import { EntityList } from "@/ui/components/list/EntityList";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { useMemo } from "react";
import { useLocation } from "wouter";

export const Military = ({ entityId }: { entityId: bigint | undefined }) => {
  const { playerStructures } = useEntities();

  const [location, _] = useLocation();

  const isMap = useMemo(() => {
    return location === "/map";
  }, [location]);

  return (
    <div className="relative">
      <div className="flex justify-end">
        <HintModalButton className="relative top-1 right-1" section={HintSection.Combat} />
      </div>
      {isMap ? (
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
