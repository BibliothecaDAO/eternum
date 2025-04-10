import { Tabs } from "@/ui/elements/tab";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { ID } from "@bibliothecadao/types"
import { useDojo } from "@bibliothecadao/react";
import { useMemo, useState } from "react";
import { CoOwners } from "./co-owners";
import { Leaderboard } from "./leaderboard";

export const HyperstructureDetails = ({ hyperstructureEntityId }: { hyperstructureEntityId: ID }) => {
  const dojo = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);

  const latestChangeEvent = LeaderboardManager.instance(dojo.setup.components).getCurrentCoOwners(
    hyperstructureEntityId,
  );

  const coOwners = latestChangeEvent?.coOwners || [];
  const timestamp = latestChangeEvent?.timestamp || 0;
  const coOwnersWithTimestamp = { coOwners, timestamp };

  const tabs = useMemo(
    () => [
      {
        key: "leaderboard",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Leaderboard</div>
          </div>
        ),
        component: <Leaderboard hyperstructureEntityId={hyperstructureEntityId} setSelectedTab={setSelectedTab} />,
      },
      {
        key: "coOwners",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Co Owners</div>
            {!coOwnersWithTimestamp && <div className="text-xs text-red animate-pulse">Required for points!</div>}
          </div>
        ),
        component: (
          <CoOwners hyperstructureEntityId={hyperstructureEntityId} coOwnersWithTimestamp={coOwnersWithTimestamp} />
        ),
      },
    ],
    [hyperstructureEntityId, coOwnersWithTimestamp],
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
