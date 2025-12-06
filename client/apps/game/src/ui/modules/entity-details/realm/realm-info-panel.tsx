import { useUIStore } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { CompactEntityInventory } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { StructureProductionPanel } from "@/ui/features/world/components/entities/structure-production-panel";
import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ClientComponents, ContractAddress, EntityType, RelicRecipientType, StructureType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { memo, useMemo } from "react";

export const RealmInfoPanel = memo(({ className }: { className?: string }) => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { setup } = useDojo();
  const components = setup.components as ClientComponents;

  const structure = useComponentValue(
    components.Structure,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Structure"]["schema"]> | null;

  const resources = useComponentValue(
    components.Resource,
    structureEntityId ? getEntityIdFromKeys([BigInt(structureEntityId)]) : undefined,
  ) as ComponentValue<ClientComponents["Resource"]["schema"]> | null;

  const isRealm = structure?.base?.category === StructureType.Realm;
  const isVillage = structure?.base?.category === StructureType.Village;

  const structureName = useMemo(() => {
    if (!structure) return null;
    return getStructureName(structure, getIsBlitz()).name;
  }, [structure]);

  if (!structure || (!isRealm && !isVillage)) {
    return (
      <div className={cn("p-3 text-xxs text-gold/70", className)}>
        Select a realm from the left panel to view production and balance.
      </div>
    );
  }

  const hasResources = Boolean(resources);

  return (
    <div className={cn("flex h-full flex-col gap-3 p-3 text-gold", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">{isRealm ? "Realm" : "Village"}</span>
          <span className="text-sm font-semibold text-gold">{structureName ?? "Structure"}</span>
        </div>
      </div>

      <div className="rounded border border-gold/20 bg-black/50 p-2">
        <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Production</span>
        <div className="mt-2">
          {hasResources ? (
            <StructureProductionPanel
              structure={structure}
              resources={resources as ComponentValue<ClientComponents["Resource"]["schema"]>}
              compact
              smallTextClass="text-xxs"
              showProductionSummary={false}
              showTooltip={false}
            />
          ) : (
            <p className="text-xxs text-gold/60 italic">No production data.</p>
          )}
        </div>
      </div>

      <div className="rounded border border-gold/20 bg-black/50 p-2">
        <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Balance</span>
        <div className="mt-2">
          <CompactEntityInventory
            resources={resources}
            recipientType={RelicRecipientType.Structure}
            entityId={structureEntityId ?? undefined}
            entityType={EntityType.STRUCTURE}
            variant="tight"
            showLabels={false}
            maxItems={12}
          />
        </div>
      </div>
    </div>
  );
});

RealmInfoPanel.displayName = "RealmInfoPanel";
