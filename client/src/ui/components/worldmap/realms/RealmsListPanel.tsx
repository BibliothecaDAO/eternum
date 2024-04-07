import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { RealmsListComponent } from "./RealmsListComponent";
import useUIStore from "../../../../hooks/store/useUIStore";
import { RaidsPanel } from "../../cityview/realm/combat/raids/RaidsPanel";
import { useCombat } from "../../../../hooks/helpers/useCombat";
import { useDojo } from "../../../../hooks/context/DojoContext";

type RealmsListPanelProps = {};

export const RealmsListPanel = ({}: RealmsListPanelProps) => {
  const {
    account: { account },
  } = useDojo();
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const { useOwnerRaiders } = useCombat();

  const ownerRaiders = useOwnerRaiders(BigInt(account.address));

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
            className="flex relative group flex-col items-center "
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
        component: <RaidsPanel raiderIds={ownerRaiders} showCreateButton={false} />,
      },
    ],
    [selectedTab, ownerRaiders],
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
