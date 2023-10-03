import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";
import { Tooltip } from "../../elements/Tooltip";
import { RealmsListComponent } from "./RealmsListComponent";

type RealmsListPanelProps = {};

export const RealmsListPanel = ({}: RealmsListPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>All Realms</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Browse all settled realms.</p>
            </Tooltip>
          </div>
        ),
        component: <RealmsListComponent />,
      },
      {
        key: "my",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>My Realms</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Browse your realms.</p>
            </Tooltip>
          </div>
        ),
        component: <RealmsListComponent onlyMyRealms />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index)}
        variant="default"
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

export default RealmsListPanel;
