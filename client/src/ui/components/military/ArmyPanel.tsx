import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";

import { TroopSelect } from "../military/TroopSelect";
import { EntityArmyList } from "./ArmyList";

export const ArmyPanel = ({ entity }: any) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Armies</div>
          </div>
        ),
        component: <EntityArmyList entity={entity} />,
      },
      {
        key: "Create",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>New Army</div>
          </div>
        ),
        component: <TroopSelect entity={entity} />,
      },
    ],
    [selectedTab, entity],
  );

  return (
    <div>
      <div className="flex justify-between">
        <h3>{entity.name}</h3>
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
