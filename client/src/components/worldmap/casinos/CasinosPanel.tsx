import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { CasinoComponent } from "./CasinoComponent";
import useUIStore from "../../../hooks/store/useUIStore";
import { CasinoWinnerComponent } from "./CasinoWinnerComponent";

type CasinosPanelProps = {};

export const CasinosPanel = ({}: CasinosPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const tabs = useMemo(
    () => [
      {
        key: "all",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">The Casino</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>The Casino</div>
          </div>
        ),
        component: <CasinoComponent />,
      },
      {
        key: "my",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">View Past Winners</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>Winners</div>
          </div>
        ),
        component: <CasinoWinnerComponent />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index)}
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
