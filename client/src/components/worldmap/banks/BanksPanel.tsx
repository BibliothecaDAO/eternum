import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import useUIStore from "../../../hooks/store/useUIStore";
import { BanksListComponent } from "./BanksListComponent";
import { useLevel } from "../../../hooks/helpers/useLevel";
import useRealmStore from "../../../hooks/store/useRealmStore";

type BanksPanelProps = {};

export const BanksPanel = ({}: BanksPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const { realmEntityId } = useRealmStore();

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

  const { getEntityLevel } = useLevel();
  const realm_level = getEntityLevel(realmEntityId)?.level;

  return (
    <>
      {realm_level === undefined || realm_level < 2 ? (
        <div className="text-gold p-4 border rounded border-gold m-2">Banks Locked until level 3</div>
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
