import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { PlayersLeaderboard } from "./PlayersLeaderboard";
import { GuildsLeaderboard } from "./GuildsLeaderboard";
import CircleButton from "@/ui/elements/CircleButton";
import { HintModal } from "../../hints/HintModal";
import { BuildingThumbs } from "@/ui/modules/navigation/LeftNavigationModule";
import { useModal } from "@/hooks/store/useModal";

export const LeaderboardPanel = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const { toggleModal } = useModal();
  const tabs = useMemo(
    () => [
      {
        key: "playersLeaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Players</div>
          </div>
        ),
        component: <PlayersLeaderboard />,
      },
      {
        key: "guildsLeaderboard",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Guilds</div>
          </div>
        ),
        component: <GuildsLeaderboard />,
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
          <CircleButton
            onClick={() => toggleModal(<HintModal initialActiveSection={"Points"} />)}
            size={"sm"}
            image={BuildingThumbs.question}
          />
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
