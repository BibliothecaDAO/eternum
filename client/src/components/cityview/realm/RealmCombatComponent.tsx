import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import useUIStore from "../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { BattalionsPanel } from "./combat/battalions/BattalionsPanel";
import { RaidsPanel } from "./combat/raids/RaidsPanel";
import { DefencePanel } from "./combat/defence/DefencePanel";

export type Order = {
  orderId: number;
  counterpartyOrderId: number;
  tradeId: number;
};

type RealmTradeComponentProps = {};

export const RealmCombatComponent = ({}: RealmTradeComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(1);
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
        key: "raids",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Check your Raiders</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Raids</div>
          </div>
        ),
        component: <RaidsPanel></RaidsPanel>,
      },
      {
        key: "battalions",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Check your Raiders</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Battalions</div>
          </div>
        ),
        component: <BattalionsPanel />,
      },
      {
        key: "defence",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Build your town watch</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Defence</div>
          </div>
        ),
        component: <DefencePanel></DefencePanel>,
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

export default RealmCombatComponent;
