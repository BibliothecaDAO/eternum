import { type Building, type RealmInfo as RealmInfoType, type ResourcesIds } from "@bibliothecadao/types";
import Bot from "lucide-react/dist/esm/icons/bot";
import Hammer from "lucide-react/dist/esm/icons/hammer";
import { useEffect, useRef, useState } from "react";

import { Tabs } from "@/ui/design-system/atoms";
import { HUD_BODY_MUTED } from "@/ui/design-system/atoms/hud-typography";
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
  realmEntityId: string;
}

export const ProductionWorkflows = ({
  realm,
  realmDisplayName,
  producedResources,
  productionBuildings,
  selectedResource,
  onSelectResource,
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
        <div className="space-y-3">
          {!selectedResource && (
            <p className={HUD_BODY_MUTED}>Pick a resource below to inspect its buildings and start production.</p>
          )}

          <BuildingsList
            realm={realm}
            onSelectProduction={onSelectResource}
            selectedResource={selectedResource}
            producedResources={producedResources}
            productionBuildings={productionBuildings}
          />

          {selectedResource && <ProductionControls selectedResource={selectedResource} realm={realm} />}
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
        <Tabs.List className="flex flex-row items-stretch gap-1 rounded-lg border border-gold/15 bg-black/25 p-1">
          {workflows.map((workflow, index) => {
            const Icon = workflow.icon;
            const isActive = activeTab === index;
            const tabClass = `flex flex-1 items-center justify-center gap-2 rounded-md border !space-x-0 ${
              isActive
                ? "border-gold/60 bg-gold/15 text-gold"
                : "border-transparent text-gold/65 hover:border-gold/40 hover:text-gold"
            } !px-3 !py-1.5 text-center !transition-none`;
            return (
              <Tabs.Tab key={workflow.label} className={tabClass} title={workflow.description}>
                <Icon className="h-4 w-4" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">{workflow.label}</span>
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        <Tabs.Panels className="mt-3">
          {workflows.map((workflow) => (
            <Tabs.Panel key={workflow.label} className="flex flex-col gap-3">
              {workflow.content}
            </Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </section>
  );
};
