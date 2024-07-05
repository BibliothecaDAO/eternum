import { useEntities } from "@/hooks/helpers/useEntities";
import { HintSection } from "@/ui/components/hints/HintModal";
import { EntityList } from "@/ui/components/list/EntityList";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { BattlesArmyTable } from "@/ui/components/military/BattlesArmyTable";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

export const Military = ({ entityId }: { entityId: bigint | undefined }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerStructures } = useEntities();

  const [location, _] = useLocation();

  const isMap = useMemo(() => {
    return location === "/map";
  }, [location]);

  const tabs = useMemo(
    () => [
      {
        key: "Armies",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Armies</div>
          </div>
        ),
        component: <EntitiesArmyTable />,
      },
      {
        key: "Battles",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Battles</div>
          </div>
        ),
        component: <BattlesArmyTable />,
      },
    ],
    [selectedTab],
  );

  return (
    <div className="relative">
      <HintModalButton className="absolute top-1 right-1" section={HintSection.Combat} />
      {isMap ? (
        <Tabs
          selectedIndex={selectedTab}
          onChange={(index: number) => setSelectedTab(index)}
          variant="default"
          className=""
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
      ) : (
        <EntityList
          current={entityId}
          list={playerStructures()}
          title="armies"
          panel={({ entity }) => <ArmyPanel structure={entity} />}
          className="pt-10"
        />
      )}
    </div>
  );
};
