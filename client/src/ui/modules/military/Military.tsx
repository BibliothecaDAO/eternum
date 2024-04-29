import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { military } from "@/ui/components/navigation/Config";
import { EntityList } from "@/ui/components/list/EntityList";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { EntityArmyList } from "@/ui/components/military/ArmyList";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { useEntities } from "@/hooks/helpers/useEntities";

export const Military = () => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(military));

  const { playerRealms } = useEntities();

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Settlements</div>
          </div>
        ),
        component: (
          <EntityList list={playerRealms()} title="armies" panel={({ entity }) => <ArmyPanel entity={entity} />} />
        ),
      },
      // {
      //   key: "mine",
      //   label: (
      //     <div className="flex relative group flex-col items-center">
      //       <div>All Armies</div>
      //     </div>
      //   ),
      //   component: <ArmyList />,
      // },
    ],
    [selectedTab, playerRealms()],
  );

  return (
    <OSWindow width="600px" onClick={() => togglePopup(military)} show={isOpen} title={military}>
      <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </OSWindow>
  );
};
