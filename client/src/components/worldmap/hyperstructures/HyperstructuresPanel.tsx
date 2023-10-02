import React, { useEffect, useMemo, useState } from "react";
import { Tooltip } from "../../../elements/Tooltip";
import { Tabs } from "../../../elements/tab";
import { HyperstructuresListComponent } from "./HyperstructuresListComponent";

type HyperstructuresPanelProps = {};

export const HyperstructuresPanel = ({}: HyperstructuresPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>All Hyperstructures</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Browse all Hyperstructures.</p>
            </Tooltip>
          </div>
        ),
        component: <HyperstructuresListComponent />,
      },
      {
        key: "my",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>My Order</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Look at Hyperstructure of your order.</p>
              <p className="whitespace-nowrap">Initialize or feed it with resources.</p>
            </Tooltip>
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
