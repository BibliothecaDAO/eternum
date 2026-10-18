import { resolveCompactLane } from "@/hooks/helpers/use-compact-hud";
import { type Building, type RealmInfo as RealmInfoType, ResourcesIds, resourceName } from "@bibliothecadao/types";

import { useEffect, useRef, useState } from "react";

import { HudSelect, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { isVillageLikeStructureCategory } from "@/ui/lib/structure-capabilities";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

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
  const showAutomation = useGameModeConfig().ui.showAutomation;
  const [activeTab, setActiveTab] = useState(() =>
    selectedResource || resolveCompactLane() !== null || !showAutomation ? 0 : 1,
  );
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
      icon: "build" as const,
      content: (
        <div className="space-y-3">
          {!selectedResource && (
            <p className="text-hud-muted">Pick a resource below to inspect its buildings and start production.</p>
          )}

          <div className="flex flex-col gap-1 lg:hidden">
            <span className="text-hud-label text-hud-muted">Resource</span>
            <HudSelect
              label="Resource"
              value={selectedResource === null ? "" : String(selectedResource)}
              options={[
                { value: "", label: "Select a resource" },
                ...producedResources.map((resource) => ({ value: String(resource), label: resourceName(resource) })),
              ]}
              onChange={(value) => onSelectResource(value ? (Number(value) as ResourcesIds) : null)}
            />
          </div>
          <div className="hidden lg:block">
            <BuildingsList
              realm={realm}
              onSelectProduction={onSelectResource}
              selectedResource={selectedResource}
              producedResources={producedResources}
              productionBuildings={productionBuildings}
            />
          </div>

          {selectedResource && <ProductionControls selectedResource={selectedResource} realm={realm} />}
        </div>
      ),
    },
    ...(showAutomation
      ? [
          {
            label: "Automation",
            description: "Create repeatable production rules",
            icon: "automation" as const,
            content: (
              <RealmAutomationPanel
                realmEntityId={realm.entityId.toString()}
                realmName={realmDisplayName}
                producedResources={producedResources}
                entityType={isVillageLikeStructureCategory(realm.structure?.base.category) ? "village" : "realm"}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <section className="flex flex-col gap-3">
      <HudTabs
        tabs={workflows.map((workflow, index) => ({
          key: index,
          label: workflow.label,
          icon: workflow.icon,
          title: workflow.description,
        }))}
        value={activeTab}
        onChange={handleTabChange}
      />
      <div role="tabpanel" aria-label={workflows[activeTab]?.label} className="flex flex-col gap-3">
        {workflows[activeTab]?.content}
      </div>
    </section>
  );
};
