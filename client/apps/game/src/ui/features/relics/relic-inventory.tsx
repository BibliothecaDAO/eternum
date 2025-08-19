import { Position } from "@bibliothecadao/eternum";

import { getIsBlitz } from "@bibliothecadao/eternum";

import { getEntityInfo } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { EntityWithRelics, PlayerRelicsData } from "@bibliothecadao/torii";
import { ContractAddress, RelicRecipientType, StructureType } from "@bibliothecadao/types";
import { Castle, Crown, Landmark, Pickaxe, Sparkles, Swords } from "lucide-react";
import { useMemo } from "react";
import { RelicCard } from "./relic-card";

interface RelicInventoryProps {
  relicsData: PlayerRelicsData;
}

export const RelicInventory = ({ relicsData }: RelicInventoryProps) => {
  const getStructureIcon = (structureType: StructureType) => {
    switch (structureType) {
      case StructureType.Realm:
        return <Crown className="w-5 h-5 text-gold" />;
      case StructureType.Bank:
        return <Landmark className="w-5 h-5 text-gold" />;
      case StructureType.Hyperstructure:
        return <Sparkles className="w-5 h-5 text-gold" />;
      case StructureType.FragmentMine:
        return <Pickaxe className="w-5 h-5 text-gold" />;
      case StructureType.Village:
        return <Castle className="w-5 h-5 text-gold" />;
    }
  };

  const EntitySection = ({
    title,
    entities,
    icon,
  }: {
    title: string;
    entities: EntityWithRelics[];
    icon: React.ReactNode;
  }) => {
    const {
      setup: { components },
    } = useDojo();
    const totalRelics = entities.reduce((sum, entity) => sum + entity.relics.length, 0);
    const entitiesWithInfo = useMemo(() => {
      return entities
        .filter((entity) => entity.relics.length > 0)
        .map((entity) => {
          return {
            ...entity,
            position: new Position({ x: entity.position.x, y: entity.position.y }).getNormalized(),
            info: getEntityInfo(entity.entityId, ContractAddress("0x0"), components, getIsBlitz()),
          };
        });
    }, [entities]);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-gold/20 pb-2">
          {icon}
          <h3 className="text-lg font-bold text-gold">{title}</h3>
          <span className="text-sm text-gold/60">
            ({entities.length} {entities.length === 1 ? "entity" : "entities"}, {totalRelics} relics)
          </span>
        </div>

        {entitiesWithInfo.length === 0 ? (
          <div className="text-center py-6 text-gold/60">
            <div>No {title.toLowerCase()} with relics found</div>
          </div>
        ) : (
          <div className="space-y-4">
            {entitiesWithInfo.map((entity) => (
              <div key={entity.entityId} className="bg-brown/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {entity.info.structureCategory && getStructureIcon(entity.info.structureCategory)}
                    {!entity.info.structureCategory && <Swords className="w-5 h-5 text-gold" />}
                    <h4 className="font-semibold text-gold">{entity.info.name?.name}</h4>
                    <span className="text-xs text-gold/60">ID: {entity.entityId}</span>
                  </div>
                  <div className="text-sm text-gold/70">
                    Position: ({entity.position.x}, {entity.position.y})
                  </div>
                </div>

                {entity.relics.length === 0 ? (
                  <div className="text-sm text-gold/60 italic">No relics</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                    {entity.relics.map((relic) => {
                      const isActive = false;

                      return (
                        <RelicCard
                          key={`${entity.entityId}-${relic.resourceId}`}
                          resourceId={relic.resourceId}
                          amount={relic.amount}
                          entityId={entity.entityId}
                          entityOwnerId={entity.structureType ? entity.entityId : Number(entity.info.explorer?.owner)}
                          entityType={entity.structureType ? RelicRecipientType.Structure : RelicRecipientType.Explorer}
                          isActive={isActive}
                          onActivate={(resourceId, amount) => {
                            console.log(
                              `Activating relic ${resourceId} (amount: ${amount}) on entity ${entity.entityId}`,
                            );
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const totalEntities = relicsData.structures.length + relicsData.armies.length;
  const totalRelics =
    relicsData.structures.reduce((sum, entity) => sum + entity.relics.length, 0) +
    relicsData.armies.reduce((sum, entity) => sum + entity.relics.length, 0);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gold mb-2">Your Relic Collection</h2>
        <div className="text-sm text-gold/70">
          {totalEntities} entities • {totalRelics} total relics
        </div>
      </div>

      <EntitySection
        title="Structures"
        entities={relicsData.structures}
        icon={<Castle className="w-5 h-5 text-gold" />}
      />

      <EntitySection title="Armies" entities={relicsData.armies} icon={<Swords className="w-5 h-5 text-gold" />} />

      {totalRelics === 0 && (
        <div className="text-center py-12 text-gold/60">
          <div className="text-lg mb-2">No relics found</div>
          <div className="text-sm">Explore the world and open crates to collect powerful relics!</div>
        </div>
      )}
    </div>
  );
};
