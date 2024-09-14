import { world } from "@/dojo/world";
import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { Component, defineComponentSystem, getComponentValue, World } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useState } from "react";

const EVENT_STREAM_SIZE = 8;

enum EventType {
  SettleRealm = "SettleRealmData",
  MapExplored = "MapExplored",
  BattleStart = "BattleStartData",
  BattleJoin = "BattleJoinData",
  BattleLeave = "BattleLeaveData",
  BattleClaim = "BattleClaimData",
  BattlePillage = "BattlePillageData",
  Swap = "SwapEvent",
  HyperstructureFinished = "HyperstructureFinished",
  HyperstructureContribution = "HyperstructureContribution",
  AcceptOrder = "AcceptOrder",
}

const EVENT_CONFIG = {
  [EventType.SettleRealm]: { action: "settled a realm", emoji: "🏰", color: "#FFAB91" },
  [EventType.MapExplored]: { action: "explored a tile", emoji: "🌎", color: "#A5D6A7" },
  [EventType.BattleJoin]: { action: "joined a battle", emoji: "⚔️", color: "#EF9A9A" },
  [EventType.BattleLeave]: { action: "left a battle", emoji: "🏃", color: "#90CAF9" },
  [EventType.BattleClaim]: { action: "claimed a structure", emoji: "🏴", color: "#FFCC80" },
  [EventType.BattlePillage]: { action: "pillaged a structure", emoji: "💰", color: "#CE93D8" },
  [EventType.Swap]: { action: "made a swap", emoji: "🔄", color: "#80DEEA" },
  [EventType.HyperstructureFinished]: { action: "finished a hyperstructure", emoji: "⭐", color: "#FFF59D" },
  [EventType.HyperstructureContribution]: { action: "contributed to a hyperstructure", emoji: "🏗️", color: "#FFD54F" },
  [EventType.AcceptOrder]: { action: "accepted an order", emoji: "✅", color: "#C5E1A5" },
};

interface EventData {
  name: string | undefined;
  eventType: EventType;
  timestamp: number;
}

export const EventStream = () => {
  const {
    setup: { components },
  } = useDojo();
  const [eventList, setEventList] = useState<EventData[]>([]);
  const { getAddressNameFromEntity } = getEntitiesUtils();

  const createEvent = (entity: any, component: any, eventType: EventType): EventData => {
    const componentValue = getComponentValue(component, entity);
    const armyEntityId =
      componentValue?.joiner_army_entity_id ||
      componentValue?.leaver_army_entity_id ||
      componentValue?.claimer_army_entity_id ||
      componentValue?.pillager_army_entity_id ||
      0;
    const entityOwner = getComponentValue(components.EntityOwner, getEntityIdFromKeys([BigInt(armyEntityId)]));
    const entityId =
      componentValue?.entity_owner_id ||
      componentValue?.entity_id ||
      componentValue?.taker_id ||
      componentValue?.contributor_entity_id ||
      0;
    const name = entityOwner
      ? getAddressNameFromEntity(entityOwner?.entity_owner_id)
      : getAddressNameFromEntity(entityId);

    return {
      name,
      eventType,
      timestamp: componentValue?.timestamp || 0,
    };
  };

  const createEventStream = (world: World, component: Component<any>, eventType: EventType) => {
    defineComponentSystem(
      world,
      component,
      (update) => {
        const event = createEvent(update.entity, component, eventType);
        setEventList((prev) => [event, ...prev]);
      },
      { runOnInit: true },
    );
  };

  // use effect will run 2 times in dev because of strict mode activated
  // so events will be duplicated
  useEffect(() => {
    Object.keys(EVENT_CONFIG).forEach((eventType) => {
      createEventStream(world, components.events[eventType as keyof typeof components.events], eventType as EventType);
    });

    return () => setEventList([]);
  }, [world]);

  return (
    <div>
      {eventList
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-EVENT_STREAM_SIZE)
        .map((event, index) => {
          const { action, emoji, color } = EVENT_CONFIG[event.eventType as keyof typeof EVENT_CONFIG];
          return (
            <div key={index} style={{ color }}>
              {emoji} {event.name || "Unknown"} {action} [{new Date(event.timestamp * 1000).toLocaleString()}]
            </div>
          );
        })}
    </div>
  );
};
