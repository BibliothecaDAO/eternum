import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useUIStore from "../../../../../hooks/store/useUIStore";
import { Headline } from "../../../../../elements/Headline";
import { Tabs } from "../../../../../elements/tab";
import { MergeNewSoldiersPanel } from "./MergeNewSoldiersPanel";
import { MergeExistingSoldiersPanel } from "./MergeExistingSoldiersPanel";
import { useLocation, useRoute } from "wouter";
import { SeparateSoldiersPanel } from "./SeparateSoldiersPanel";
import { CombatInfo } from "@bibliothecadao/eternum";

type ManageSoldiersPopupTabsProps = {
  headline: string;
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const ManageSoldiersPopupTabs = ({ headline, selectedRaider, onClose }: ManageSoldiersPopupTabsProps) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const { realmEntityId } = useRealmStore();

  // const moveCameraToMarketView = useUIStore((state) => state.moveCameraToMarketView);
  // const moveCameraToCaravansView = useUIStore((state) => state.moveCameraToCaravansView);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @ts-ignore
  const [location, setLocation] = useLocation();
  // @ts-ignore
  const [match, params]: any = useRoute("/realm/:id/:tab");

  const unitIsDefence = useMemo(() => {
    return selectedRaider.sec_per_km === 0;
  }, [selectedRaider]);

  // useEffect(() => {
  //   if ([0, 1, 2].includes(selectedTab)) {
  //     moveCameraToMarketView();
  //   } else if ([3, 4].includes(selectedTab)) {
  //     moveCameraToCaravansView();
  //   }
  // }, [selectedTab]);

  useEffect(() => {
    const tabIndex = tabs.findIndex((tab) => tab.key === params?.tab);
    if (tabIndex >= 0) {
      if (selectedRaider.quantity === 0) {
        setSelectedTab(0);
      } else if (selectedRaider.quantity < 2 && tabIndex === 2) {
        setSelectedTab(1);
      } else {
        setSelectedTab(tabIndex);
      }
    }
  }, [params]);

  const tabs = useMemo(
    () => [
      {
        key: "new-soldiers",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Add new soldiers to your unit</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>New Soldiers</div>
          </div>
        ),
        component: (
          <MergeNewSoldiersPanel
            isDefence={unitIsDefence}
            selectedRaider={selectedRaider}
            onClose={onClose}
          ></MergeNewSoldiersPanel>
        ),
      },
      {
        key: "merge-soldiers",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Merge soldiers from different units into selected unit</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Merge Soldiers</div>
          </div>
        ),
        component: (
          <MergeExistingSoldiersPanel
            isDefence={unitIsDefence}
            onClose={onClose}
            selectedRaider={selectedRaider}
          ></MergeExistingSoldiersPanel>
        ),
      },
      {
        key: "separate-soldiers",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Separate unit in 2 different units</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>Separate Soldiers</div>
          </div>
        ),
        component: (
          <SeparateSoldiersPanel
            isDefence={unitIsDefence}
            onClose={onClose}
            selectedRaider={selectedRaider}
          ></SeparateSoldiersPanel>
        ),
      },
    ],
    [selectedTab],
  );

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Manage Raiders:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline>{headline}</Headline>
          <div className="flex relative mt-1 justify-between text-xxs text-lightest w-full">
            <>
              <Tabs
                selectedIndex={selectedTab}
                onChange={(index: any) => setLocation(`/realm/${realmEntityId}/${tabs[index].key}`)}
                variant="default"
                className="h-full "
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
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
