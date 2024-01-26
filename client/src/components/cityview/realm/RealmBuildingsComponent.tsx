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
import { LaborBuildingsPanel } from "./buildings/labor/LaborBuildingsPanel";

type RealmBuildingsComponentProps = {};

export const RealmBuildingsComponent = ({}: RealmBuildingsComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
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
      if (tabIndex !== 1) setSelectedTab(tabIndex);
    }
  }, [params]);

  const tabs = useMemo(
    () => [
      {
        key: "labor-buildings",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Construct labor buildings</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Labor</div>
          </div>
        ),
        component: <LaborBuildingsPanel />,
      },
      {
        key: "military-buildings",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Coming Soon</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Military</div>
          </div>
        ),
        component: <div />,
      },
    ],
    [selectedTab, raiderIds],
  );

  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

  return (
    <>
      {realm_level === undefined || realm_level < 0 ? (
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

export default RealmBuildingsComponent;
