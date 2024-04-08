import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";

import Button from "@/ui/elements/Button";

// TODO: Turn into generic list component

const exampleEntities = [
  { id: 1, name: "Stolsi" },
  { id: 2, name: "Settlement 1" },
  { id: 3, name: "Settlement 2" },
];

export const EntityList = () => {
  const [selectedBank, setSelectedBank] = useState(null);

  const handleBankClick = (bank: any) => {
    setSelectedBank(bank);
  };

  const handleBreadcrumbClick = () => {
    setSelectedBank(null);
  };

  return (
    <div className="p-2">
      {selectedBank ? (
        <div>
          <Button className="mb-3" variant="outline" size="xs" onClick={handleBreadcrumbClick}>
            &lt; Back to list
          </Button>

          <EntityPanel bank={selectedBank} />
        </div>
      ) : (
        <>
          <ul>
            {exampleEntities.map((bank) => (
              <li
                className="text-xl my-1 border-b flex justify-between"
                key={bank.id}
                onClick={() => handleBankClick(bank)}
              >
                {bank.name} <span>see</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const EntityPanel = ({ bank }: any) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>All Armies</div>
          </div>
        ),
        component: <></>,
      },
      {
        key: "New Army",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>All Troops</div>
          </div>
        ),
        component: <></>,
      },
    ],
    [selectedTab],
  );

  return (
    <div>
      <div className="flex justify-between">
        <h3>{bank.name}</h3>

        <div>Banker: 0x..420</div>
      </div>

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
  );
};
