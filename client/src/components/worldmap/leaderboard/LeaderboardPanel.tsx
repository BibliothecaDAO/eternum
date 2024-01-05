import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import useUIStore from "../../../hooks/store/useUIStore";
import { RealmsLeaderboard } from "./RealmsLeaderboard";
import { useComputeLordsLeaderboards } from "../../../hooks/store/useLeaderBoardStore";
import { OrdersLeaderboard } from "./OrdersLeaderboard";

export const LeaderboardPanel = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  useComputeLordsLeaderboards();

  const tabs = useMemo(
    () => [
      {
        key: "leaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Realms</div>
          </div>
        ),
        component: <RealmsLeaderboard />,
      },
      {
        key: "leaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Orders</div>
          </div>
        ),
        component: <OrdersLeaderboard />,
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
