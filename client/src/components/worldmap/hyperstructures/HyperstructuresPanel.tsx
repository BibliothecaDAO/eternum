import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { HyperstructuresListComponent } from "./HyperstructuresListComponent";
import useUIStore from "../../../hooks/store/useUIStore";
import { HyperstructureLeaderboard } from "./HyperstructureLeaderboard";

type HyperstructuresPanelProps = {};

export const HyperstructuresPanel = ({}: HyperstructuresPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Browse all Hyperstructures.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>All Hyperstructures</div>
          </div>
        ),
        component: <HyperstructuresListComponent />,
      },
      {
        key: "my",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Look at Hyperstructure of your order.</p>
                    <p className="whitespace-nowrap">Initialize or feed it with resources.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>My Order</div>
          </div>
        ),
        component: <HyperstructuresListComponent showOnlyPlayerOrder />,
      },
      {
        key: "leaderboard",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Leaderboard based on Hyperstructure feeding.</p>
                    <p className="whitespace-nowrap">Resources give points based on rarity.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>Leaderboard</div>
          </div>
        ),
        component: <HyperstructureLeaderboard />,
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
