import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { military } from "@/ui/components/navigation/Config";
import { EntityList } from "@/ui/components/list/EntityList";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { useEntities } from "@/hooks/helpers/useEntities";

export const Military = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(military));

  const { playerRealms } = useEntities();

  return (
    <OSWindow width="600px" onClick={() => togglePopup(military)} show={isOpen} title={military}>
      <EntityList
        current={entityId}
        list={playerRealms()}
        title="armies"
        panel={({ entity }) => <ArmyPanel entity={entity} />}
      />
    </OSWindow>
  );
};
