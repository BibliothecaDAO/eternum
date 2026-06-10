import { type Building, type RealmInfo as RealmInfoType, type ResourcesIds } from "@bibliothecadao/types";
import Bot from "lucide-react/dist/esm/icons/bot";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import { useEffect, useRef, useState } from "react";

import { Tabs } from "@/ui/design-system/atoms";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";

import { BuildingsList } from "./buildings-list";
import { ProductionControls } from "./production-controls";
import { RealmAutomationPanel } from "./realm-automation-panel";

interface ProductionWorkflowsProps {
  realm: RealmInfoType;
  realmDisplayName: string;
  producedResources: ResourcesIds[];
  productionBuildings: Building[];
  selectedResource: ResourcesIds | null;
  onSelectResource: (resource: ResourcesIds | null) => void;
  wonderBonus: number;
  productionBonus: number;
  troopsBonus: number;
  realmEntityId: string;
}

export const ProductionWorkflows = ({
  realm,
  realmDisplayName,
  producedResources,
  productionBuildings,
  selectedResource,
  onSelectResource,
  wonderBonus,
  productionBonus,
  troopsBonus,
}: ProductionWorkflowsProps) => {
  const [activeTab, setActiveTab] = useState(() => (selectedResource ? 0 : 1));
  const previousSelectedResourceRef = useRef<ResourcesIds | null>(selectedResource ?? null);

  useEffect(() => {
    const previous = previousSelectedResourceRef.current;
    if (selectedResource !== null && previous === null && activeTab !== 0) {
      setActiveTab(0);
    }
    previousSelectedResourceRef.current = selectedResource ?? null;
  }, [selectedResource, activeTab]);

  const handleTabChange = (index: number) => {
    setActiveTab(index);
    if (index === 1 && selectedResource !== null) {
      onSelectResource(null);
    }
  };

  const workflows = [
    {
      label: "Manual Production",
      description: "Direct control over buildings and output",
      icon: Hammer,
      content: (
        <div className="space-y-4">
          {!selectedResource && (
            <div className="flex items-start gap-3 rounded-lg border border-gold/30 bg-dark-brown/70 px-4 py-3 text-sm text-gold/80">
              <span className="font-semibold text-gold">Select a building</span>
              <span className="text-left">
                Choose any resource card below to inspect its buildings and manage production.
              </span>
            </div>
          )}

          <BuildingsList
            realm={realm}
            onSelectProduction={onSelectResource}
            selectedResource={selectedResource}
            producedResources={producedResources}
            productionBuildings={productionBuildings}
          />

          {selectedResource && (
            <ProductionControls
              selectedResource={selectedResource}
              realm={realm}
              wonderBonus={wonderBonus}
              productionBonus={productionBonus}
              troopsBonus={troopsBonus}
            />
          )}
        </div>
      ),
    },
    {
      label: "Automation",
      description: "Create repeatable production rules",
      icon: Bot,
      content: (
        <RealmAutomationPanel
          realmEntityId={realm.entityId.toString()}
          realmName={realmDisplayName}
          producedResources={producedResources}
          entityType={isVillageLikeStructureCategory(realm.structure?.category) ? "village" : "realm"}
        />
      ),
    },
  ];

  return (
    <section className="space-y-3">
      <Tabs selectedIndex={activeTab} onChange={handleTabChange} className="w-full" variant="default">
        <Tabs.List className="flex flex-row items-stretch gap-1 rounded-lg border border-gold/25 bg-dark-brown/80 p-1">
          {workflows.map((workflow, index) => {
            const Icon = workflow.icon;
            const isActive = activeTab === index;
            const tabClass = `flex flex-1 items-center justify-center gap-2 rounded-md border !space-x-0 ${
              isActive
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-transparent bg-dark-brown/90 text-gold/75 hover:border-gold/40 hover:text-gold"
            } !px-3 !py-1.5 text-center !transition-none`;
            return (
              <Tabs.Tab key={workflow.label} className={tabClass} title={workflow.description}>
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{workflow.label}</span>
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        <Tabs.Panels className="mt-4">
          {workflows.map((workflow) => (
            <Tabs.Panel key={workflow.label} className="flex flex-col gap-4">
              {workflow.content}
            </Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </section>
  );
};
