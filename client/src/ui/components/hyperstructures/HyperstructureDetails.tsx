import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { CoOwners } from "./CoOwners";
import { Leaderboard } from "./Leaderboard";

export const HyperstructureDetails = ({ hyperstructureEntityId }: { hyperstructureEntityId: bigint }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "leaderboard",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Leaderboard</div>
          </div>
        ),
        component: <Leaderboard hyperstructureEntityId={hyperstructureEntityId} />,
      },
      {
        key: "coOwners",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Co Owners</div>
          </div>
        ),
        component: <CoOwners />,
      },
    ],
    [hyperstructureEntityId],
  );

  return (
    <>
      {
        <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
          <Tabs.List>
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index} className="h-full">
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      }
    </>
  );
};
