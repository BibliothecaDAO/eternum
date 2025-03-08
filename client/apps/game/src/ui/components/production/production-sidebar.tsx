import { ResourceIcon } from "@/ui/elements/resource-icon";
import { getBlockTimestamp } from "@/utils/timestamp";
import { ID, RealmInfo, resources } from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { HasValue, runQuery } from "@dojoengine/recs";
import { memo, useMemo } from "react";

interface ProductionSidebarProps {
  realms: RealmInfo[];
  selectedRealmEntityId: ID;
  onSelectRealm: (id: ID) => void;
}

const SidebarRealm = ({
  realm,
  isSelected,
  onSelect,
}: {
  realm: RealmInfo;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const {
    setup: {
      components,
      components: { Resource, Building },
    },
  } = useDojo();

  const buildings = useMemo(() => {
    const buildings = runQuery([
      HasValue(Building, {
        outer_entity_id: realm.entityId,
      }),
    ]);

    return buildings;
  }, [realm]);

  const resourceManager = useResourceManager(realm.entityId);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-gold/20" : "hover:bg-gold/10"}`}
    >
      <h3 className="text-xl font-bold mb-2">{realm.name}</h3>

      <div className="flex flex-wrap gap-2 mb-2">
        {Object.values(realm.resources).map((resource) => {
          const balance = resourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, resource);
          if (balance > 0) {
            return (
              <ResourceIcon
                key={resource}
                resource={resources.find((r) => r.id === resource)?.trait || ""}
                size="sm"
                className="opacity-80"
              />
            );
          }
          return null;
        })}
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gold/80">
          <span>{buildings.size} buildings</span>
        </div>
      </div>
    </div>
  );
};

export const ProductionSidebar = memo(({ realms, selectedRealmEntityId, onSelectRealm }: ProductionSidebarProps) => {
  return (
    <div className="space-y-4">
      {realms.map((realm) => (
        <SidebarRealm
          key={realm.entityId}
          realm={realm}
          isSelected={realm.entityId === selectedRealmEntityId}
          onSelect={() => onSelectRealm(realm.entityId)}
        />
      ))}
    </div>
  );
});
