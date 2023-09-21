import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { CaravansPanel } from "./trade/Caravans/CaravansPanel";
import { MarketPanel } from "./trade/Market/MarketPanel";
import { MyOffersPanel } from "./trade/MyOffers/MyOffersPanel";
import useUIStore from "../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { Tooltip } from "../../../elements/Tooltip";
import { RoadsPanel } from "./trade/Roads/RoadsPanel";

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
        key: "my-offers",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>My Offers</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Check offers made by you,</p>
              <p className="whitespace-nowrap">watch incoming caravans,</p>
              <p className="whitespace-nowrap">claim arrived resources,</p>
              <p className="whitespace-nowrap">or create new offers.</p>
            </Tooltip>
          </div>
        ),
        component: <MyOffersPanel />,
      },
      {
        key: "open-offers",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Open Offers</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Offers from all over the world are found here.</p>
              <p className="whitespace-nowrap">Trade with your fellow Lords</p>
            </Tooltip>
          </div>
        ),
        component: <MarketPanel directOffers={false} />,
      },
      {
        key: "direct-offers",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Direct Offers</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Offers made specifically for you are found here.</p>
            </Tooltip>
          </div>
        ),
        component: <MarketPanel directOffers={true} />,
      },
      {
        key: "caravans",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Caravans</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">You can only trade resources if there are Caravans to carry them.</p>
              <p className="whitespace-nowrap">Manage your Caravans here</p>
            </Tooltip>
          </div>
        ),
        component: <CaravansPanel />,
      },
      {
        key: "roads",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Roads</div>
            <Tooltip position="bottom">
              <p className="whitespace-nowrap">Build roads to other Realms to</p>
              <p className="whitespace-nowrap">get faster travel time for orders.</p>
            </Tooltip>
          </div>
        ),
        component: <RoadsPanel />,
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
