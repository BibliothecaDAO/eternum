import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo } from "react";

const EVENT_STREAM_SIZE = 8;

enum Actions {
  MapExplored = "explored a tile",
  BattleJoin = "joined a battle",
  BattleLeave = "left a battle",
  BattleClaim = "claimed a structure",
  BattlePillage = "pillaged a structure",
  Swap = "made a swap",
  HyperstructureFinished = "finished a hyperstructure",
  AcceptOrder = "accepted an order",
}

enum Emojis {
  MapExplored = "🗺️",
  BattleJoin = "⚔️",
  BattleLeave = "🏃",
  BattleClaim = "🏴",
  BattlePillage = "💰",
  Swap = "🔄",
  HyperstructureFinished = "🏗️",
  AcceptOrder = "✅",
}

export const EventStream = () => {
  const {
    setup: { components },
  } = useDojo();

  const { getAddressNameFromEntity } = getEntitiesUtils();

  const mapExploredEntities = useEntityQuery([Has(components.MapExplored)]);
  const battleJoinEntities = useEntityQuery([Has(components.BattleJoinData)]);
  const battleLeaveEntities = useEntityQuery([Has(components.BattleLeaveData)]);
  const battleClaimEntities = useEntityQuery([Has(components.BattleClaimData)]);
  const battlePillageEntities = useEntityQuery([Has(components.BattlePillageData)]);
  const swapEntities = useEntityQuery([Has(components.SwapEvent)]);
  const acceptOrderEntities = useEntityQuery([Has(components.AcceptOrder)]);

  const allEvents = useMemo(() => {
    const createEvent = (entity: any, component: any, action: Actions, emoji: Emojis) => {
      const componentValue = getComponentValue(component, entity);

      const armyEntityId =
        // armies
        componentValue?.joiner_army_entity_id ||
        componentValue?.leaver_army_entity_id ||
        componentValue?.claimer_army_entity_id ||
        componentValue?.pillager_army_entity_id ||
        0;

      const entityOwner = getComponentValue(components.EntityOwner, getEntityIdFromKeys([BigInt(armyEntityId)]));

      const entityId =
        // structures
        componentValue?.entity_owner_id || componentValue?.entity_id || componentValue?.taker_id || 0;

      const name = entityOwner
        ? getAddressNameFromEntity(entityOwner?.entity_owner_id)
        : getAddressNameFromEntity(entityId);

      return {
        name,
        action,
        emoji,
        timestamp: componentValue?.timestamp,
      };
    };

    const events = [
      ...mapExploredEntities.map((entity) =>
        createEvent(entity, components.MapExplored, Actions.MapExplored, Emojis.MapExplored),
      ),
      ...battleJoinEntities.map((entity) =>
        createEvent(entity, components.BattleJoinData, Actions.BattleJoin, Emojis.BattleJoin),
      ),
      ...battleLeaveEntities.map((entity) =>
        createEvent(entity, components.BattleLeaveData, Actions.BattleLeave, Emojis.BattleLeave),
      ),
      ...battleClaimEntities.map((entity) =>
        createEvent(entity, components.BattleClaimData, Actions.BattleClaim, Emojis.BattleClaim),
      ),
      ...battlePillageEntities.map((entity) =>
        createEvent(entity, components.BattlePillageData, Actions.BattlePillage, Emojis.BattlePillage),
      ),
      ...swapEntities.map((entity) => createEvent(entity, components.SwapEvent, Actions.Swap, Emojis.Swap)),
      ...acceptOrderEntities.map((entity) =>
        createEvent(entity, components.AcceptOrder, Actions.AcceptOrder, Emojis.AcceptOrder),
      ),
    ];

    // Sort events by timestamp in descending order (most recent first)
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }, [
    mapExploredEntities,
    battleJoinEntities,
    battleLeaveEntities,
    battleClaimEntities,
    battlePillageEntities,
    swapEntities,
    acceptOrderEntities,
    components,
    getAddressNameFromEntity,
  ]);

  return (
    <div style={{ zIndex: 100 }}>
      <div>
        {allEvents.slice(-EVENT_STREAM_SIZE).map((event, index) => (
          <div key={index}>
            {event.emoji} {event.name || "Unknown"} {event.action} [{new Date(event.timestamp * 1000).toLocaleString()}]
          </div>
        ))}
      </div>
    </div>
  );
};
