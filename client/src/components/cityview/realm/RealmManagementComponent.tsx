import { useEffect, useMemo, useState } from "react";
import { ReactComponent as CrossSwords } from "../../../assets/icons/common/cross-swords.svg";
import { ReactComponent as PickAxeSecond } from "../../../assets/icons/common/pick-axe-second.svg";
import { ReactComponent as Coin } from "../../../assets/icons/common/coin.svg";
import { ReactComponent as City } from "../../../assets/icons/common/city.svg";
import { useLocation, useRoute } from "wouter";
import { Tabs } from "../../../elements/tab";
import RealmTradeComponent from "./RealmTradeComponent";
import RealmLaborComponent from "./RealmLaborComponent";
import useUIStore from "../../../hooks/store/useUIStore";
import useRealmStore from "../../../hooks/store/useRealmStore";
import RealmCombatComponent from "./RealmCombatComponent";
import RealmInfoComponent from "./RealmInfoComponent";

const RealmManagementComponent = () => {
  const { realmEntityId } = useRealmStore();

  const [selectedTab, setSelectedTab] = useState(1);

  const [_location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  const moveCameraToLaborView = useUIStore((state) => state.moveCameraToLaborView);

  const setTooltip = useUIStore((state) => state.setTooltip);

  useEffect(() => {
    if (selectedTab == 0) {
      moveCameraToLaborView();
    } else {
      moveCameraToMarketView();
    }
  }, [selectedTab]);

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
            className={`flex relative group flex-col items-center`}
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
        key: "Crafting",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Coming Soon</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex flex-col items-center"
            title="Not implemented"
          >
            <City className="mb-2 fill-gold" /> <div>Crafting</div>
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
    <div className="flex flex-col flex-1 z-10 overflow-auto">
      <RealmInfoComponent />
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
    </div>
  );
};

export default RealmManagementComponent;
