import { useMemo, useState } from "react";
import { ReactComponent as Relic } from "@/assets/icons/common/relic.svg";
import { ReactComponent as Bank } from "@/assets/icons/common/bank.svg";
import { ReactComponent as Leaderboard } from "@/assets/icons/common/leaderboard.svg";
import { ReactComponent as City } from "@/assets/icons/common/city.svg";
import { ReactComponent as World } from "@/assets/icons/common/world.svg";
import { useLocation } from "wouter";
import { Tabs } from "../../elements/tab";
import RealmsListPanel from "./realms/RealmsListPanel";
import { HyperstructuresPanel } from "./hyperstructures/HyperstructuresPanel";
import useUIStore from "../../../hooks/store/useUIStore";
import { BanksPanel } from "./banks/BanksPanel";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useLevel } from "../../../hooks/helpers/useLevel";
import { LeaderboardPanel } from "./leaderboard/LeaderboardPanel";

const WorldMapMenuComponent = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @ts-ignore
  const [_location, setLocation] = useLocation();

  const { realmEntityIds } = useRealmStore();
  const { getEntityLevel } = useLevel();

  const minimumRealmLevel = useMemo(() => {
    let min = 0;
    realmEntityIds.forEach((realmEntityId) => {
      const realm_level = getEntityLevel(realmEntityId.realmEntityId)?.level;
      if (realm_level && realm_level > min) {
        min = realm_level;
      }
    });
    return min;
  }, [realmEntityIds]);

  const tabs = useMemo(
    () => [
      {
        key: "realms",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className=" whitespace-nowrap">Search for all existing</p>
                    <p className=" whitespace-nowrap">Realms here.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <City className="mb-2 fill-gold" />
            <div>Realms</div>
          </div>
        ),
        component: <RealmsListPanel />,
      },
      {
        key: "hyperstructures",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    {/* <p className="whitespace-nowrap">See, build or feed</p>
                    <p className="whitespace-nowrap">Hyperstructures.</p> */}
                    <p className="whitespace-nowrap">Coming Soon</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center blur-sm"
          >
            <Relic className="mb-2 fill-gold" /> <div>Hyperstructures</div>
          </div>
        ),
        component: <HyperstructuresPanel minimumRealmLevel={minimumRealmLevel} />,
      },
      {
        key: "banks",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    {/* <p className="whitespace-nowrap">Swap food for</p>
                    <p className="whitespace-nowrap">Lords.</p> */}
                    <p className="whitespace-nowrap">Coming Soon</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center blur-sm"
          >
            <Bank className="mb-2 fill-gold" /> <div>Banks</div>
          </div>
        ),
        component: <BanksPanel minimumRealmLevel={minimumRealmLevel} />,
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
                    {/* <p className="whitespace-nowrap">Lords Leaderboard</p> */}
                    <p className="whitespace-nowrap">Coming Soon</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center blur-sm"
          >
            <Leaderboard className="mb-2 fill-gold" /> <div>Leaderboard</div>
          </div>
        ),
        component: <LeaderboardPanel />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      {/* <div className="relative rounded-t-xl transition-colors duration-300 text-sm shadow-lg shadow-black/25 flex items-center px-4 py-2 text-white min-h-[50px]">
        <div className="flex items-center ml-auto capitalize">
          <World className="w-4 h-4 fill-white" />
        </div>
      </div> */}
      <Tabs
        selectedIndex={selectedTab}
        onChange={() => setSelectedTab(0)}
        variant="primary"
        className="flex-1 mt-4 overflow-hidden"
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

export default WorldMapMenuComponent;
