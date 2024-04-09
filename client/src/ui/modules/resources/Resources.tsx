import useUIStore from "../../../hooks/store/useUIStore";
import { OSWindow } from "../../components/navigation/OSWindow";
import { leaderboard, resources } from "../../components/navigation/Config";
import { EntityResourceTable } from "../../components/resources/EntityResourceTable";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import useRealmStore from "@/hooks/store/useRealmStore";

export const Resources = () => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(resources));

  // This should be replaced with Selected entity - so Realms, Settlement etc
  let { realmEntityId } = useRealmStore();
  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Balance</div>
          </div>
        ),
        component: <EntityResourceTable entityId={realmEntityId} />,
      },
      {
        key: "mine",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Production</div>
          </div>
        ),
        component: <div>Production</div>,
      },
    ],
    [selectedTab],
  );
  return (
    <OSWindow onClick={() => togglePopup(resources)} show={isOpen} title={resources}>
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
