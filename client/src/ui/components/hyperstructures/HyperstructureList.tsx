import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { EntityResourceTable } from "../resources/EntityResourceTable";
import Button from "@/ui/elements/Button";

const exampleBanks = [
  { id: 1, name: "Loaf", location: { x: 1, y: 1 } },
  { id: 2, name: "Rashel", location: { x: 1, y: 1 } },
  { id: 3, name: "Credence", location: { x: 1, y: 1 } },
  { id: 4, name: "1337", location: { x: 1, y: 1 } },
];

export const HyperStructureList = () => {
  const [selectedHyperstructure, setHyperstructure] = useState(null);

  const handleBankClick = (bank: any) => {
    setHyperstructure(bank);
  };

  const handleBreadcrumbClick = () => {
    setHyperstructure(null);
  };

  return (
    <div className="p-2">
      {selectedHyperstructure ? (
        <div>
          <Button className="mb-3" variant="outline" size="xs" onClick={handleBreadcrumbClick}>
            &lt; Back to Bank List
          </Button>
          <HyperstructurePanel hyperstructure={selectedHyperstructure} />
        </div>
      ) : (
        <>
          <h2>HyperStructures</h2>
          <ul>
            {exampleBanks.map((bank) => (
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

const HyperstructurePanel = ({ hyperstructure }: any) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Status</div>
          </div>
        ),
        component: <></>,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Send Resources</div>
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
        <h3>{hyperstructure.name}</h3>

        <div>Owner: 0x..420</div>
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
