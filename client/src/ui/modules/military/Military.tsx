import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { EntityArmyList } from "@/ui/components/military/ArmyList";
import { EntitiesArmyTable } from "@/ui/components/military/EntitiesArmyTable";
import { UserBattles } from "@/ui/components/military/UserBattles";
import { Tabs } from "@/ui/elements/tab";
import { ID } from "@bibliothecadao/eternum";
import { useState } from "react";

export const Military = ({ entityId, className }: { entityId: ID | undefined; className?: string }) => {
  const { isMapView } = useQuery();
  const { playerStructures } = useEntities();
  const selectedStructure = playerStructures().find((structure) => structure.entity_id === entityId);

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    {
      label: "Army",
      component: isMapView ? (
        <EntitiesArmyTable />
      ) : (
        selectedStructure && <EntityArmyList structure={selectedStructure} />
      ),
    },
    { label: "Battles", component: <UserBattles /> },
  ];

  return (
    <div className={`relative ${className}`}>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => {
          setSelectedTab(index);
        }}
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
    </div>
  );
};
