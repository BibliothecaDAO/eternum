import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../../../elements/tab";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { EnnemyRaidersPanel } from "./EnnemyRaidsPanel";
import { AttackHistoryPanel } from "./AttackHistoryPanel";

export type Order = {
  orderId: number;
  counterpartyOrderId: number;
  tradeId: number;
};

type AttacksComponentProps = {};

export const AttacksComponent = ({}: AttacksComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const { realmEntityId } = useRealmStore();

  const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  const moveCameraToCaravansView = useUIStore((state) => state.moveCameraToCaravansView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @ts-ignore
  const [location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  useEffect(() => {
    if ([0, 1, 2].includes(selectedTab)) {
      moveCameraToMarketView();
    } else if ([3, 4].includes(selectedTab)) {
      moveCameraToCaravansView();
    }
  }, [selectedTab]);

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
        component: <EnnemyRaidersPanel />,
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
