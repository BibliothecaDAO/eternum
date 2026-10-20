import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { StructureWorkspace } from "@/ui/design-system/molecules/structure-workspace";
import { EntityResourceTable } from "@/ui/features/economy/resources";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";
import { useEffect, useState } from "react";

/** Every holding's balances: the shared structure switcher on the left, the chosen holding's balances on the right. */
export const BalancesView = () => {
  const structures = useFactView(playerStructuresView);
  const [selectedId, setSelectedId] = useState<number | null>(structures[0]?.entityId ?? null);

  useEffect(() => {
    if (selectedId && structures.some((structure) => structure.entityId === selectedId)) return;
    setSelectedId(structures[0]?.entityId ?? null);
  }, [selectedId, structures]);

  if (!structures.length) return <p className="p-4 text-hud-muted">No structures yet.</p>;

  return (
    <StructureWorkspace
      sidebar={
        <StructureSidebar
          selectedEntityId={selectedId ?? 0}
          onSelectStructure={setSelectedId}
          title="Your structures"
          enableCategoryFilter
        />
      }
    >
      <div className="min-h-0 overflow-y-auto px-3 py-2">
        {selectedId ? (
          <EntityResourceTable entityId={selectedId} />
        ) : (
          <p className="text-hud-muted">Select a structure.</p>
        )}
      </div>
    </StructureWorkspace>
  );
};
