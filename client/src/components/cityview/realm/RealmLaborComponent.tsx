import { useEffect, useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { LaborPanel } from "./labor/LaborPanel";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import { useRoute, useLocation } from "wouter";

type RealmLaborComponentProps = {};

export const RealmLaborComponent = ({ }: RealmLaborComponentProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const { realmEntityId } = useRealmStore();

  const moveCameraToLaborView = useUIStore((state) => state.moveCameraToLaborView);
  const moveCameraToFoodView = useUIStore((state) => state.moveCameraToFoodView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @ts-ignore
  const [location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  useEffect(() => {
    let _tab: string = "";
    if (["food", "farm", "fish"].includes(params?.tab as string)) {
      _tab = "food";
      moveCameraToFoodView();
    } else {
      _tab = params?.tab as any;
      moveCameraToLaborView();
    }
    const tabIndex = tabs.findIndex((tab) => tab.key === _tab);
    if (tabIndex >= 0) {
      setSelectedTab(tabIndex);
    }
  }, [params]);

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
                    <p className="whitespace-nowrap">Look at your current production,</p>
                    <p className="whitespace-nowrap">or increase it by buying labour or buildings.</p>
                    <p className="whitespace-nowrap">Don't forget to harvest your resources.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>All</div>
          </div>
        ),
        component: <LaborPanel />,
      },
      {
        key: "food",
        label: (
          <div className="flex flex-col items-center">
            <div>Food</div>
          </div>
        ),
        component: <LaborPanel type="food" />,
      },
      {
        key: "mines",
        label: (
          <div className="flex flex-col items-center">
            <div>Mines</div>
          </div>
        ),
        component: <LaborPanel type="mines" />,
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

export default RealmLaborComponent;
