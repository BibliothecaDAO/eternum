import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../../../elements/tab";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { EnnemyRaidersPanel } from "./EnnemyRaidsPanel";
import { AttackHistoryPanel } from "./AttackHistoryPanel";
import { getPosition } from "../../../../../utils/utils";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { useDojo } from "../../../../../context/DojoContext";

type AttacksComponentProps = {};

export const AttacksComponent = ({}: AttacksComponentProps) => {
  const {
    account: {
      account: { address },
    },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const { realmEntityId, realmId } = useRealmStore();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const { useEnemyRaidersOnPosition } = useCombat();
  const realmPosition = realmId ? getPosition(realmId) : undefined;
  const raiderIds = realmPosition ? useEnemyRaidersOnPosition(BigInt(address), realmPosition) : [];

  // @ts-ignore
  const [location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  // useEffect(() => {
  //   if ([0, 1, 2].includes(selectedTab)) {
  //     moveCameraToMarketView();
  //   } else if ([3, 4].includes(selectedTab)) {
  //     moveCameraToCaravansView();
  //   }
  // }, [selectedTab]);

  useEffect(() => {
    const tabIndex = tabs.findIndex((tab) => tab.key === params?.tab);
    if (tabIndex >= 0) {
      setSelectedTab(tabIndex);
    }
  }, [params]);

  const tabs = useMemo(
    () => [
      {
        key: "ennemy-raiders",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Ennemies on your realm</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div> Current Attacks </div>
          </div>
        ),
        component: <EnnemyRaidersPanel raiderIds={raiderIds} className="p-2 min-h-[120px]" />,
      },
      {
        key: "attack-history",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Previous attacks</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Attack History</div>
          </div>
        ),
        component: <AttackHistoryPanel />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setLocation(`/realm/${realmEntityId}/${tabs[index].key}`)}
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

export default AttacksComponent;
