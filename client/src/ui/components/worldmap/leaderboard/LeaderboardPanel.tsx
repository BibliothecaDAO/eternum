import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { PlayersLeaderboard } from "./PlayersLeaderboard";

export const LeaderboardPanel = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "leaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Players</div>
          </div>
        ),
        component: <PlayersLeaderboard />,
      },
      // {
      //   key: "leaderboard",
      //   label: (
      //     <div className="flex group relative flex-col items-center">
      //       <div>Orders</div>
      //     </div>
      //   ),
      //   component: <OrdersLeaderboard />,
      // },
    ],
    [selectedTab],
  );

  return (
    <>
      <div className="my-3 p-4">
        {/* {resourceName && <ResourceIcon className="mr-2 self-center" size="lg" resource={resourceName} />} */}
        <h4 className="flex mt-2 justify-center w-full">
          <div>Leaderboard</div>
        </h4>
        <p className="text-center">Find these on the map....</p>
      </div>

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
