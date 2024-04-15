import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { ResourceSwap } from "./Swap";

import { BankEntityList } from "./BankEntityList";
import { EntityList } from "../list/EntityList";
import { useBanks } from "@/hooks/helpers/useBanks";

// These would be entities passed into the table
// export const exampleEntities = [
//   {
//     name: "Stolsi",
//     id: 1,
//   },
//   {
//     name: "Bank 2",
//     id: 2,
//   },
//   {
//     name: "Bank 3",
//     id: 3,
//   },
// ];

export const BankPanel = ({ entity }: any) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const { getMyAccounts } = useBanks();

  const myBankAccountsIds = getMyAccounts(entity.id, 0);

  const myBankAccountList = myBankAccountsIds.map((id) => {
    return {
      id,
      name: `Bank Account ${id}`,
    };
  });

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
        component: (
          <EntityList
            title="Banks"
            panel={({ entity }) => <BankEntityList entity={entity} />}
            list={myBankAccountList}
          />
        ),
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
        <h3>{entity.name}</h3>

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
