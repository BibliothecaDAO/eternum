import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { HyperstructuresListComponent } from "./HyperstructuresListComponent";
import useUIStore from "../../../../hooks/store/useUIStore";
// import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import { useRefreshHyperstructure } from "../../../../hooks/store/useRefreshHyperstructure";
import Button from "../../../elements/Button";
import { LevelingBonusIcons } from "../../cityview/realm/leveling/Leveling";
import { LevelIndex } from "../../../../hooks/helpers/useLevel";

type HyperstructuresPanelProps = {
  minimumRealmLevel: number;
};

export const HyperstructuresPanel = ({ minimumRealmLevel }: HyperstructuresPanelProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);
  const hyperstructures = useUIStore((state) => state.hyperstructures);

  const { refreshAllHyperstructures, isLoading } = useRefreshHyperstructure();

  const bonusList = useMemo(() => {
    if (!hyperstructures) return [];
    const bonusAmount = conqueredHyperstructureNumber * 25;

    return [
      {
        bonusType: LevelIndex.FOOD,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.RESOURCE,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.TRAVEL,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.COMBAT,
        bonusAmount,
      },
    ];
  }, [hyperstructures]);

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
                    <p className="whitespace-nowrap">Browse all Hyperstructures.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex relative group flex-col items-center"
          >
            <div>All Hyperstructures</div>
          </div>
        ),
        component: <HyperstructuresListComponent />,
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
                    <p className="whitespace-nowrap">Look at Hyperstructure of your order.</p>
                    <p className="whitespace-nowrap">Initialize or feed it with resources.</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => setTooltip(null)}
            className="flex group relative flex-col items-center"
          >
            <div>My Order</div>
          </div>
        ),
        component: <HyperstructuresListComponent showOnlyPlayerOrder />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      {minimumRealmLevel < 4 ? (
        <div className="text-gold p-4 border rounded border-gold m-2">Hyperstructures Locked until level 4</div>
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
          <div className="flex m-2 justify-between text-gold text-xxs">
            <div className="flex items-center text-wrap">
              <div className="mr-1">Conquered:</div>
              <div className="text-white">{conqueredHyperstructureNumber}</div>
            </div>
            <div className="flex flex-row text-center items-center">
              <div className="text-center ">Bonus:</div>
              <LevelingBonusIcons
                className="flex flex-row ml-1 mr-2 items-center justify-center  !text-xxs"
                bonuses={bonusList}
                includeZero={true}
              ></LevelingBonusIcons>
            </div>
            <Button
              variant="outline"
              isLoading={isLoading}
              className={"cursor-pointer my-1"}
              size="xs"
              onClick={() => refreshAllHyperstructures()}
            >
              Refresh
            </Button>
          </div>
          <Tabs.Panels className="overflow-hidden">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      )}
      ;
    </>
  );
};
