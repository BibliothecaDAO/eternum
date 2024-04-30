import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { resources } from "@/ui/components/navigation/Config";
import { EntityResourceTable } from "@/ui/components/resources/EntityResourceTable";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";

export const Resources = ({ entityId }: { entityId: bigint | undefined }) => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(resources));

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Balance</div>
          </div>
        ),
        component: <EntityResourceTable entityId={entityId} />,
      },
    ],
    [selectedTab, entityId],
  );

  return (
    <OSWindow onClick={() => togglePopup(resources)} show={isOpen} title={resources}>
      <EntityResourceTable entityId={entityId} />
      {/* <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
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
      </Tabs> */}
    </OSWindow>
  );
};
