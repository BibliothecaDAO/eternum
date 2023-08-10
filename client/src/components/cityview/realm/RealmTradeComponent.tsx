import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { CaravansPanel } from "./trade/Caravans/CaravansPanel";
import { MarketPanel } from "./trade/Market/MarketPanel";
import { MyOffersPanel } from "./trade/MyOffers/MyOffersPanel";
import { IncomingOrdersPanel } from "./trade/Caravans/IncomingOrdersPanel";
import useUIStore from "../../../hooks/store/useUIStore";

export type Order = {
  orderId: number;
  counterpartyOrderId: number;
  tradeId: number;
};

type RealmTradeComponentProps = {};

export const RealmTradeComponent = ({}: RealmTradeComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(1);

  const moveCameraToMarketView = useUIStore(
    (state) => state.moveCameraToMarketView,
  );
  const moveCameraToCaravansView = useUIStore(
    (state) => state.moveCameraToCaravansView,
  );

  useEffect(() => {
    if ([0, 1].includes(selectedTab)) {
      moveCameraToMarketView();
    } else if ([2, 3].includes(selectedTab)) {
      moveCameraToCaravansView();
    }
  }, [selectedTab]);

  const tabs = useMemo(
    () => [
      {
        label: (
          <div className="flex flex-col items-center">
            <div>My Offers</div>
          </div>
        ),
        component: <MyOffersPanel />,
      },
      {
        label: (
          <div className="flex flex-col items-center">
            <div>Market</div>
          </div>
        ),
        component: <MarketPanel />,
      },
      {
        label: (
          <div className="flex flex-col items-center">
            <div>Caravans</div>
          </div>
        ),
        component: <CaravansPanel />,
      },
      {
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
        onChange={(index) => setSelectedTab(index as number)}
        variant="default"
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels>
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </>
  );
};

export default RealmTradeComponent;
