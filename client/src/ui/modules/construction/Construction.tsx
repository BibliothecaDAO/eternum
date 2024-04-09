import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { construction, trade } from "@/ui/components/navigation/Config";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { SelectPreviewBuilding } from "@/ui/components/construction/SelectPreviewBuilding";
export const Construction = () => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(construction));
  // const tabs = useMemo(
  //   () => [
  //     {
  //       key: "all",
  //       label: (
  //         <div className="flex relative group flex-col items-center">
  //           <div>Realm</div>
  //         </div>
  //       ),
  //       component: <SelectPreviewBuilding />,
  //     },
  //   ],
  //   [selectedTab],
  // );
  return (
    <OSWindow width="500px" onClick={() => togglePopup(construction)} show={isOpen} title={construction}>
      <SelectPreviewBuilding />
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
