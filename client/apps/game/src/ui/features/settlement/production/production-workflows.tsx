import type { Building, RealmInfo as RealmInfoType, ResourcesIds } from "@bibliothecadao/types";
import { Bot, Hammer } from "lucide-react";
import { useState } from "react";

import { Tabs } from "@/ui/design-system/atoms";
import { AutomationTable } from "@/ui/features/infrastructure";

import { BuildingsList } from "./buildings-list";
import { ProductionControls } from "./production-controls";

interface ProductionWorkflowsProps {
  realm: RealmInfoType;
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
  producedResources,
  productionBuildings,
  selectedResource,
  onSelectResource,
  wonderBonus,
  productionBonus,
  troopsBonus,
  realmEntityId,
}: ProductionWorkflowsProps) => {
  const [activeTab, setActiveTab] = useState(0);

  const workflows = [
    {
      label: "Manual Production",
      description: "Direct control over buildings and output",
      icon: Hammer,
      content: (
        <div className="space-y-4">
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
        <AutomationTable realmInfo={realm} availableResources={producedResources} realmEntityId={realmEntityId} />
      ),
    },
  ];

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-gold">Production Workflows</h3>
        <p className="text-sm text-gold/70">Choose how you want to manage this realm's output.</p>
      </div>

      <Tabs
        selectedIndex={activeTab}
        onChange={(index: number) => setActiveTab(index)}
        className="w-full"
        variant="default"
      >
        <Tabs.List className="flex flex-col gap-2 rounded-xl border border-gold/25 bg-dark-brown/80 p-2 sm:flex-row sm:items-stretch sm:justify-start justify-start">
          {workflows.map((workflow, index) => {
            const Icon = workflow.icon;
            const isActive = activeTab === index;
            const tabClass = `group flex min-w-[220px] flex-1 items-center gap-3 rounded-lg border !space-x-0 ${
              isActive
                ? "border-gold/60 bg-gold/15 text-gold shadow-lg shadow-gold/15"
                : "border-transparent bg-dark-brown/90 text-gold/80 hover:border-gold/40"
            } !px-4 !py-3 text-left !transition-none`;
            const iconWrapperClass = `flex h-10 w-10 items-center justify-center rounded-md border ${
              isActive ? "border-gold/60 bg-gold/20 text-gold" : "border-gold/40 bg-dark-brown/70 text-gold/70"
            }`;

            return (
              <Tabs.Tab key={workflow.label} className={tabClass}>
                <div className={iconWrapperClass}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold tracking-wide">{workflow.label}</span>
                  <span className="text-xs text-gold/60">{workflow.description}</span>
                </div>
              </Tabs.Tab>
            );
          })}
        </Tabs.List>

        <Tabs.Panels className="mt-6">
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
