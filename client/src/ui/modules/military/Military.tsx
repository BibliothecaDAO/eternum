import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { military } from "@/ui/components/navigation/Config";
import { EntityList } from "@/ui/components/list/EntityList";
import { useMemo, useState } from "react";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { useEntities } from "@/hooks/helpers/useEntities";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { useLocation } from "wouter";

export const Military = ({ entityId }: { entityId: bigint | undefined }) => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(military));

  const { playerRealms } = useEntities();

  const [location, _] = useLocation();

  const isMap = useMemo(() => {
    return location === "/map";
  }, [location]);

  return (
    <div>
      {isMap ? (
        // <EntityArmyTable entityId={entityId} />
        <EntitiesArmyTable />
      ) : (
        <EntityList
          current={entityId}
          list={playerRealms()}
          title="armies"
          panel={({ entity }) => <ArmyPanel entity={entity} />}
        />
      )}
    </div>
  );
};
