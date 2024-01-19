import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import useUIStore from "../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { RaidsPanel } from "./combat/raids/RaidsPanel";
import { DefencePanel } from "./combat/defence/DefencePanel";
import { useLevel } from "../../../hooks/helpers/useLevel";
import { useCombat } from "../../../hooks/helpers/useCombat";
import { useDojo } from "../../../DojoContext";

type RealmCombatComponentProps = {};

export const RealmCombatComponent = ({}: RealmCombatComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(1);
  const { realmEntityId } = useRealmStore();
  const { useRealmRaiders } = useCombat();

  const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  const moveCameraToCaravansView = useUIStore((state) => state.moveCameraToCaravansView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @note: useOwnerRaiders would be useful for a all realms management window
  const raiderIds = useRealmRaiders(realmEntityId);

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
            <div>Raiders</div>
          </div>
        ),
        component: <RaidsPanel raiderIds={raiderIds} showCreateButton={true} className=" pb-3 min-h-[120px]" />,
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
        component: <DefencePanel />,
      },
    ],
    [selectedTab, raiderIds],
  );

  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

  return (
    <>
      {realm_level === undefined || realm_level < 3 ? (
        <div className="text-gold p-4 border rounded border-gold m-2">Combat Locked until level 3</div>
      ) : (
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
      )}
    </>
  );
};

export default RealmCombatComponent;
