import { EntityList } from "@/ui/components/list/EntityList";
import { useMemo, useState } from "react";
import { ArmyPanel } from "@/ui/components/military/ArmyPanel";
import { useEntities } from "@/hooks/helpers/useEntities";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { useLocation } from "wouter";
import { BattlesArmyTable } from "@/ui/components/military/BattlesArmyTable";
import { Tabs } from "@/ui/elements/tab";
import { useModal } from "@/hooks/store/useModal";
import { HintModalButton } from "@/ui/elements/HintModalButton";

export const Military = ({ entityId }: { entityId: bigint | undefined }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const { playerStructures } = useEntities();
  const { toggleModal } = useModal();

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
      <HintModalButton className="absolute top-1 right-1" sectionName="Combat" />
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
          panel={({ entity }) => <ArmyPanel entity={entity} />}
        />
      )}
    </div>
  );
};
