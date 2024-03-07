import { useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";
import { RealmsListComponent } from "./RealmsListComponent";
import useUIStore from "../../hooks/store/useUIStore";
import { RaidsPanel } from "../cityview/realm/combat/raids/RaidsPanel";
import { useCombat } from "../../hooks/helpers/useCombat";
import useRealmStore from "../../hooks/store/useRealmStore";

type RealmsListPanelProps = {};

export const RealmsListPanel = ({}: RealmsListPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { getRealmRaidersIds } = useCombat();
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const realmRaiders = useMemo(() => {
    return realmEntityIds.flatMap((realmEntityId) => {
      return getRealmRaidersIds(realmEntityId.realmEntityId);
    });
  }, [realmEntityIds]);

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
                    <p className="whitespace-nowrap">Browse all settled realms.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>All Realms</div>
          </div>
        ),
        component: <RealmsListComponent />,
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
                    <p className="whitespace-nowrap">Browse your realms.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>My Realms</div>
          </div>
        ),
        component: <RealmsListComponent onlyMyRealms />,
      },
      {
        key: "my-raiders",
        label: (
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Browse your raiders.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>My Raiders</div>
          </div>
        ),
        component: <RaidsPanel raiderIds={realmRaiders} showCreateButton={false} />,
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

export default RealmsListPanel;
