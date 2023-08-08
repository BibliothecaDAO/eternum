import { useEffect, useMemo, useState } from "react";
import { BaseContainer } from "../../../containers/BaseContainer";
import { SecondaryContainer } from "../../../containers/SecondaryContainer";
import { ReactComponent as CrossSwords } from "../../../assets/icons/common/cross-swords.svg";
import { ReactComponent as PickAxeSecond } from "../../../assets/icons/common/pick-axe-second.svg";
import { ReactComponent as Coin } from "../../../assets/icons/common/coin.svg";
import { ReactComponent as City } from "../../../assets/icons/common/city.svg";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { useLocation } from "wouter";

import { Tabs } from "../../../elements/tab";
import RealmTradeComponent from "./RealmTradeComponent";
import RealmLaborComponent from "./RealmLaborComponent";
import useUIStore from "../../../hooks/store/useUIStore";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealm } from "../../../hooks/graphql/useGraphQLQueries";

const RealmManagementComponent = () => {
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm({ entityId: realmEntityId });

  const [selectedTab, setSelectedTab] = useState(1);

  const [location, setLocation] = useLocation();

  const moveCameraToRealmView = useUIStore(
    (state) => state.moveCameraToRealmView,
  );
  const moveCameraToLaborView = useUIStore(
    (state) => state.moveCameraToLaborView,
  );

  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);

  useEffect(() => {
    if (selectedTab == 0) {
      moveCameraToLaborView();
    } else {
      moveCameraToRealmView();
    }
  }, [selectedTab]);

  const showOnMap = () => {
    setLocation("/map");
    moveCameraToRealm(realm?.realmId as number);
  };

  const tabs = useMemo(
    () => [
      {
        label: (
          <div className="flex items-center">
            <PickAxeSecond className="mr-2 fill-current" /> <div>Labor</div>
          </div>
        ),
        component: <RealmLaborComponent />,
      },
      {
        label: (
          <div className="flex items-center">
            <Coin className="mr-2 fill-current" /> <div>Trade</div>
          </div>
        ),
        component: <RealmTradeComponent />,
      },
    ],
    [selectedTab],
  );
  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index as number)}
        variant="primary"
        className="flex-1 mt-[6px] overflow-hidden"
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
      <button
        onClick={showOnMap}
        className="absolute flex items-center hover:bg-gold/20 transition-bg duration-200 z-10 px-2 py-1 ml-auto text-xxs border rounded-md right-3 top-[3.9rem] text-gold border-gold"
      >
        <Map className="mr-1 fill-current" />
        Show on map
      </button>
    </>
  );
};

export default RealmManagementComponent;
