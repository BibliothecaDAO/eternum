import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { CaravansPanel } from "./trade/Caravans/CaravansPanel";
import { MarketPanel } from "./trade/Market/MarketPanel";
import { MyOffersPanel } from "./trade/MyOffers/MyOffersPanel";
import { IncomingOrdersPanel } from "./trade/Caravans/IncomingOrdersPanel";
import useUIStore from "../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";

export type Order = {
  orderId: number;
  counterpartyOrderId: number;
  tradeId: number;
};

type RealmTradeComponentProps = {};

export const RealmTradeComponent = ({}: RealmTradeComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(1);
  const { realmEntityId } = useRealmStore();

  const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  const moveCameraToCaravansView = useUIStore((state) => state.moveCameraToCaravansView);

  // @ts-ignore
  const [location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params] = useRoute("/realm/:id/:tab");

  useEffect(() => {
    if ([0, 1].includes(selectedTab)) {
      moveCameraToMarketView();
    } else if ([2, 3].includes(selectedTab)) {
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
        key: "my-offers",
        label: (
          <div className="flex flex-col items-center">
            <div>My Offers</div>
          </div>
        ),
        component: <MyOffersPanel />,
      },
      {
        key: "market",
        label: (
          <div className="flex flex-col items-center">
            <div>Market</div>
          </div>
        ),
        component: <MarketPanel />,
      },
      {
        key: "caravans",
        label: (
          <div className="flex flex-col items-center">
            <div>Caravans</div>
          </div>
        ),
        component: <CaravansPanel />,
      },
      {
        key: "incoming-caravans",
        label: (
          <div className="flex flex-col items-center">
            <div> Incoming Caravans </div>
          </div>
        ),
        component: <IncomingOrdersPanel />,
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

export default RealmTradeComponent;
