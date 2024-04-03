import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";

import { useDojo } from "../../../DojoContext";
import { FixedHexagonInformation } from "./FixedHexagonInformation";

export const HexagonInformationPanel = () => {
  const {
    account: { account },
  } = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "hex",
        label: (
          <div className="flex relative group flex-col items-center ">
            <div>Hex</div>
          </div>
        ),
        component: <FixedHexagonInformation />,
      },
      {
        key: "combat",
        label: (
          <div className="flex relative group flex-col items-center ">
            <div>Combat</div>
          </div>
        ),
        component: <></>,
      },
      {
        key: "entities",
        label: (
          <div className="flex relative group flex-col items-center ">
            <div>Entities</div>
          </div>
        ),
        component: <></>,
      },
      {
        key: "build",
        label: (
          <div className="flex relative group flex-col items-center ">
            <div>Build</div>
          </div>
        ),
        component: <></>,
      },
    ],

    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index)}
        variant="primary"
        className="h-full"
      >
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
    </>
  );
};

export default HexagonInformationPanel;
