import { useMemo, useState } from "react";
import { ReactComponent as Relic } from "../../assets/icons/common/relic.svg";
import { ReactComponent as City } from "../../assets/icons/common/city.svg";
import { ReactComponent as World } from "../../assets/icons/common/world.svg";
import { useLocation } from "wouter";
import { Tabs } from "../../elements/tab";
import RealmsListPanel from "./RealmsListPanel";
import { HyperstructuresPanel } from "./hyperstructures/HyperstructuresPanel";
import useUIStore from "../../hooks/store/useUIStore";

const WorldMapMenuComponent = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // @ts-ignore
  const [_location, setLocation] = useLocation();

  const tabs = useMemo(
    () => [
      {
        key: "realms",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className=" whitespace-nowrap">Search for all existing</p>
                    <p className=" whitespace-nowrap">Realms here.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <City className="mb-2 fill-gold" />
            <div>Realms</div>
          </div>
        ),
        component: <RealmsListPanel />,
      },
      {
        key: "hyperstructures",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">See, build or feed</p>
                    <p className="whitespace-nowrap">Hyperstructures.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <Relic className="mb-2 fill-gold" /> <div>Hyperstructures</div>
          </div>
        ),
        component: <HyperstructuresPanel />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <div className="relative rounded-t-xl transition-colors duration-300 text-sm shadow-lg shadow-black/25 flex items-center px-4 py-2 text-white min-h-[50px]">
        <div className="flex flex-col leading-4">
          <div className="font-bold">Eternum Map</div>
        </div>
        <div className="flex items-center ml-auto capitalize">
          <World className="w-4 h-4 fill-white" />
        </div>
      </div>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: number) => setSelectedTab(index)}
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

export default WorldMapMenuComponent;
