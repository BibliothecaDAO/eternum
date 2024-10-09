import { ReactComponent as Check } from "@/assets/icons/Check.svg";
import { ReactComponent as Chest } from "@/assets/icons/Chest.svg";
import { ReactComponent as Coins } from "@/assets/icons/Coins.svg";
import { ReactComponent as Combat } from "@/assets/icons/Combat.svg";
import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { ReactComponent as Compass } from "@/assets/icons/Compass.svg";
import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Scroll } from "@/assets/icons/Scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/Sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/Swap.svg";
import { ReactComponent as Wrench } from "@/assets/icons/Wrench.svg";
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
  [EventType.SettleRealm]: {
    action: "settled a realm",
    emoji: <Crown className="w-6 self-center" />,
    color: "#FFAB91",
  },
  [EventType.MapExplored]: {
    action: "explored a tile",
    emoji: <Compass className="w-6 self-center fill-[#ED9733]" />,
    color: "#ED9733",
  },
  [EventType.BattleJoin]: {
    action: "joined a battle",
    emoji: <Combat className="w-6 self-center" />,
    color: "#EF9A9A",
  },
  [EventType.BattleLeave]: { action: "left a battle", emoji: <Scroll className="w-6 self-center" />, color: "#90CAF9" },
  [EventType.BattleClaim]: {
    action: "claimed a structure",
    emoji: <Chest className="w-6 self-center" />,
    color: "#FFCC80",
  },
  [EventType.BattlePillage]: {
    action: "pillaged a structure",
    emoji: <Coins className="w-6 self-center" />,
    color: "#CE93D8",
  },
  [EventType.Swap]: { action: "made a swap", emoji: <Swap className="w-6 self-center" />, color: "#80DEEA" },
  [EventType.HyperstructureFinished]: {
    action: "finished a hyperstructure",
    emoji: <Sparkles className="w-6 self-center" />,
    color: "#FFF59D",
  },
  [EventType.HyperstructureContribution]: {
    action: "contributed to a hyperstructure",
    emoji: <Wrench className="w-6 self-center" />,
    color: "#FFD54F",
  },
  [EventType.AcceptOrder]: {
    action: "accepted an order",
    emoji: <Check className="w-6 self-center" />,
    color: "#C5E1A5",
  },
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

  const [hideEventStream, setHideEventStream] = useState(false);
  const [eventList, setEventList] = useState<EventData[]>([]);
  const { getAddressNameFromEntity } = getEntitiesUtils();

  const createEvent = (entity: any, component: any, eventType: EventType): EventData | undefined => {
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

    if (entityId === 0 && !entityOwner) return;

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
        if (!event) return;
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
    <div className="h-full w-[30vw]">
      <div
        className="flex flex-row text-sm text-center"
        onClick={() => {
          setHideEventStream(!hideEventStream);
        }}
      >
        <div className="bg-black/10 h-6 w-6 rounded-t">
          <Minimize className="w-4 h-4 fill-gold self-center mx-auto" />
        </div>
      </div>
      {hideEventStream ? (
        <div className="bg-black/5 p-1 rounded-tr rounded-bl rounded-br border border-black/10 h-full w-full min-w-full">
          Events
        </div>
      ) : (
        <div className="bg-black/40 bg-hex-bg  rounded-bl-2xl p-1 rounded-tr  border border-gold/40 h-full">
          {eventList
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-EVENT_STREAM_SIZE)
            .map((event, index) => {
              const { action, emoji, color } = EVENT_CONFIG[event.eventType as keyof typeof EVENT_CONFIG];
              return (
                <div className="hover:bg-black/20 rounded flex gap-1" key={index}>
                  {emoji} [{event.name || "Unknown"}]: {action}{" "}
                  <span className="opacity-50">[{new Date(event.timestamp * 1000).toLocaleString()}]</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
