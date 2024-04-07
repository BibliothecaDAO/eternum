import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import useUIStore from "../../../../hooks/store/useUIStore";
import { BanksListComponent } from "./BanksListComponent";

type BanksPanelProps = { minimumRealmLevel: number };

export const BanksPanel = ({ minimumRealmLevel }: BanksPanelProps) => {
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
                    <p className="whitespace-nowrap">Browse all Banks.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>All Banks</div>
          </div>
        ),
        component: <BanksListComponent />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      {minimumRealmLevel < 2 ? (
        <div className="text-gold p-4 border rounded border-gold m-2">Banks Locked until level 2</div>
      ) : (
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
      )}
    </>
  );
};
