import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { trade } from "@/ui/components/navigation/Config";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";

export const Trading = () => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(trade));
  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Market</div>
          </div>
        ),
        component: <div>Marketplace</div>,
      },
      {
        key: "transfer",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Transfer</div>
          </div>
        ),
        component: <div>Transfer Between Entities</div>,
      },
    ],
    [selectedTab],
  );
  return (
    <OSWindow width="600px" onClick={() => togglePopup(trade)} show={isOpen} title={trade}>
      {/* COMPONENTS GO HERE */}
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
