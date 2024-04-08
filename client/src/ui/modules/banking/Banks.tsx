import useUIStore from "@/hooks/store/useUIStore";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { banks } from "@/ui/components/navigation/Config";
import { Tabs } from "@/ui/elements/tab";

import { useMemo, useState } from "react";
import { BankPanel } from "@/ui/components/bank/BankList";
import { EntityList } from "@/ui/components/list/EntityList";

const exampleBanks = [
  { id: 1, name: "Iron Bank" },
  { id: 2, name: "Bank of Loaf" },
  { id: 2, name: "Bank of Power" },
];

export const Banks = () => {
  const { togglePopup } = useUIStore();
  const [selectedTab, setSelectedTab] = useState(0);
  const isOpen = useUIStore((state) => state.isPopupOpen(banks));

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>All Banks</div>
          </div>
        ),
        component: (
          <EntityList title="Banks" panel={({ entity }) => <BankPanel entity={entity} />} list={exampleBanks} />
        ),
      },
      {
        key: "mine",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Banks</div>
          </div>
        ),
        component: <></>,
      },
    ],
    [selectedTab],
  );

  return (
    <OSWindow width="600px" onClick={() => togglePopup(banks)} show={isOpen} title={banks}>
      <div>
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
      </div>
    </OSWindow>
  );
};
