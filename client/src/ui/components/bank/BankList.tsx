import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";
import { EntityResourceTable } from "../resources/EntityResourceTable";
import Button from "@/ui/elements/Button";

const exampleBanks = [
  { id: 1, name: "Iron Bank" },
  { id: 2, name: "Bank of Loaf" },
  { id: 2, name: "Bank of Power" },
];

export const BankList = () => {
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
            &lt; Back to Bank List
          </Button>
          <BankPanel bank={selectedBank} />
        </div>
      ) : (
        <>
          <h2>Banks</h2>
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

const BankPanel = ({ bank }: any) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Swap</div>
          </div>
        ),
        component: <ResourceSwap />,
      },
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Account</div>
          </div>
        ),
        component: <EntityResourceTable />,
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
