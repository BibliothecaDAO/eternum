import { useEffect, useMemo, useState } from "react";
import { ReactComponent as CrossSwords } from "../../../assets/icons/common/cross-swords.svg";
import { ReactComponent as PickAxeSecond } from "../../../assets/icons/common/pick-axe-second.svg";
import { ReactComponent as Coin } from "../../../assets/icons/common/coin.svg";
import { ReactComponent as City } from "../../../assets/icons/common/city.svg";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { useLocation, useRoute } from "wouter";
import { Tabs } from "../../../elements/tab";
import RealmTradeComponent from "./RealmTradeComponent";
import RealmLaborComponent from "./RealmLaborComponent";
import useUIStore from "../../../hooks/store/useUIStore";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import { LaborAuction } from "./labor/LaborAuction";
import RealmCombatComponent from "./RealmCombatComponent";
import { Leveling } from "./leveling/Leveling";

const RealmManagementComponent = () => {
  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const [selectedTab, setSelectedTab] = useState(1);

  const [_location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  const moveCameraToLaborView = useUIStore((state) => state.moveCameraToLaborView);

  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setTooltip = useUIStore((state) => state.setTooltip);

  useEffect(() => {
    if (selectedTab == 0) {
      moveCameraToLaborView();
    } else {
      moveCameraToMarketView();
    }
  }, [selectedTab]);

  const showOnMap = () => {
    setLocation("/map");
    setIsLoadingScreenEnabled(true);
    moveCameraToWorldMapView();
    setTimeout(() => {
      moveCameraToRealm(realm?.realmId as number);
    }, 300);
  };

  const tabs = useMemo(
    () => [
      {
        key: "labor",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className=" whitespace-nowrap">Manage all of your Realm</p>
                    <p className=" whitespace-nowrap"> resource production here.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <PickAxeSecond className="mb-2 fill-gold" />
            <div>Labor</div>
          </div>
        ),
        component: <RealmLaborComponent />,
      },
      {
        key: "open-offers",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">No Realm is self-sufficient.</p>
                    <p className="whitespace-nowrap">Trade with other Lords</p>
                    <p className="whitespace-nowrap">to get the resources you need.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <Coin className="mb-2 fill-gold" /> <div>Trade</div>
          </div>
        ),
        component: <RealmTradeComponent />,
      },
      {
        key: "military",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Build military troops,</p>
                    <p className="whitespace-nowrap">Defend your Realm, raid other Realms.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex flex-col items-center "
            title="Military"
          >
            <CrossSwords className="mb-2 fill-gold" /> <div>Military</div>
          </div>
        ),
        component: <RealmCombatComponent />,
      },
      {
        key: "civilians",
        label: (
          <div className="flex flex-col items-center blur-sm cursor-not-allowed" title="Not implemented">
            <City className="mb-2 fill-gold" /> <div>Civilians</div>
          </div>
        ),
        component: <div></div>,
      },
    ],
    [selectedTab],
  );

  useEffect(() => {
    let _tab: string = "";
    if (["caravans", "market", "open-offers", "my-offers", "direct-offers"].includes(params?.tab as string)) {
      _tab = "open-offers";
    } else if (["labor", "food", "mines", "farm", "fish"].includes(params?.tab as string)) {
      _tab = "labor";
    } else if (["military", "army", "defense", "siege"].includes(params?.tab as string)) {
      _tab = "military";
    }
    const tabIndex = tabs.findIndex((tab) => tab.key === _tab);
    if (tabIndex >= 0) {
      setSelectedTab(tabIndex);
    }
  }, [params]);

  return (
    <>
      <div className="flex justify-between items-center p-3">
        <div className="flex flex-row ">
          <div className="mr-2">
            <LaborAuction />
          </div>
          <div>
            <Leveling />
          </div>
        </div>
        <button
          onClick={showOnMap}
          className="flex items-center hover:bg-gold/20 transition-bg duration-200 z-10 px-2 py-1 ml-auto text-xxs border rounded-md text-gold border-gold"
        >
          <Map className="mr-1 fill-current" />
          Show on map
        </button>
      </div>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setLocation(`/realm/${realmEntityId}/${tabs[index].key}`)}
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

export default RealmManagementComponent;
