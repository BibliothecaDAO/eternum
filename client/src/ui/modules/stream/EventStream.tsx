import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { world } from "@/dojo/world";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { ContractAddress } from "@bibliothecadao/eternum";
import { Component, defineComponentSystem, getComponentValue, World } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useState } from "react";
import { MessageIcon } from "../social/PlayerId";
import { EVENT_NOTIF_STORAGE_KEY, EVENT_STREAM_SIZE } from "./constants";
import { eventDetails } from "./eventDetails";
import { EventData, EventType } from "./types";

export const EventStream = () => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const [hideEventStream, setHideEventStream] = useState(false);
  const [eventList, setEventList] = useState<EventData[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "personal">("all");
  const [hasNewEvents, setHasNewEvents] = useState(false);
  const { getAddressNameFromEntity, getPlayerAddressFromEntity } = useEntitiesUtils();

  const createEvent = (entity: any, component: any, eventType: EventType): EventData | undefined => {
    const componentValue = getComponentValue(component, entity);
    const armyEntityId =
      componentValue?.entity_id ||
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

    const position = armyEntityId
      ? getComponentValue(components.Position, getEntityIdFromKeys([BigInt(armyEntityId)]))
      : getComponentValue(components.Position, getEntityIdFromKeys([BigInt(entityId)]));

    const name = entityOwner
      ? getAddressNameFromEntity(entityOwner?.entity_owner_id)
      : getAddressNameFromEntity(entityId);

    const owner = entityOwner
      ? getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(entityOwner.entity_owner_id)]))
      : getComponentValue(components.Owner, getEntityIdFromKeys([BigInt(entityId)]));

    const to = eventDetails[eventType].to?.(componentValue! as any, getPlayerAddressFromEntity);
    const isPersonal = to === ContractAddress(account.address);

    return {
      to,
      action: eventDetails[eventType].getAction(componentValue! as any, isPersonal),
      name,
      eventType,
      timestamp: componentValue?.timestamp || 0,
      position,
      address: owner?.address,
    };
  };

  const createEventStream = (world: World, component: Component<any>, eventType: EventType) => {
    defineComponentSystem(
      world,
      component,
      (update) => {
        const event = createEvent(update.entity, component, eventType);
        if (!event) return;
        setEventList((prev) => {
          const newEvents = [event, ...prev];
          // Check if this is a personal event
          if (event.to === ContractAddress(account.address)) {
            const lastSeen = localStorage.getItem(EVENT_NOTIF_STORAGE_KEY) || "0";
            if (event.timestamp > parseInt(lastSeen)) {
              setHasNewEvents(true);
            }
          }
          return newEvents;
        });
      },
      { runOnInit: true },
    );
  };

  useEffect(() => {
    Object.keys(eventDetails).forEach((eventType) => {
      createEventStream(world, components.events[eventType as keyof typeof components.events], eventType as EventType);
    });

    return () => setEventList([]);
  }, [world]);

  useEffect(() => {
    if (activeTab === "personal") {
      setHasNewEvents(false);
      localStorage.setItem(EVENT_NOTIF_STORAGE_KEY, Math.floor(Date.now() / 1000).toString());
    }
  }, [activeTab]);

  const filteredEvents = eventList.filter((event) => {
    if (activeTab === "personal") {
      return event.to === ContractAddress(account.address);
    }
    return true;
  });

  return (
    <div className="h-full w-[30vw]">
      <div className="flex flex-row text-sm text-center">
        <div
          className="bg-brown/10 h-6 w-6 rounded-t cursor-pointer"
          onClick={() => {
            setHideEventStream(!hideEventStream);
          }}
        >
          <Minimize className="w-4 h-4 fill-gold self-center mx-auto" />
        </div>
        {!hideEventStream && (
          <div className="flex ml-2">
            <div
              className={`px-3 py-1 cursor-pointer ${activeTab === "all" ? "bg-brown/40 text-gold" : "bg-brown/20"}`}
              onClick={() => setActiveTab("all")}
            >
              All
            </div>
            <div
              className={`px-3 py-1 cursor-pointer relative ${
                activeTab === "personal" ? "bg-brown/40 text-gold" : "bg-brown/20"
              }`}
              onClick={() => setActiveTab("personal")}
            >
              Personal
              {hasNewEvents && activeTab !== "personal" && (
                <div
                  id="new-event-indicator"
                  className="absolute -top-1 -right-1 w-2 h-2 bg-red rounded-full animate-pulse"
                />
              )}
            </div>
          </div>
        )}
      </div>
      {hideEventStream ? (
        <div className="bg-brown/5 p-1 rounded-tr rounded-bl rounded-br border border-black/10 h-full w-full min-w-full">
          Events
        </div>
      ) : (
        <div className="bg-brown/40 bg-hex-bg rounded-bl-2xl p-1 rounded-tr border border-gold/40 h-[200px]">
          {filteredEvents
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-EVENT_STREAM_SIZE)
            .map((event, index) => {
              const { emoji, color } = eventDetails[event.eventType as keyof typeof eventDetails];
              return (
                <div
                  className={`hover:bg-brown/20 w-full rounded flex gap-2 justify-between`}
                  style={{ color }}
                  key={index}
                >
                  <div className="flex items-center space-x-2 flex-grow overflow-hidden">
                    <span className="text-lg" style={{ fill: color }}>
                      {emoji}
                    </span>
                    <span className="whitespace-nowrap">[{event.name || "Unknown"}]:</span>
                    <div className="whitespace-nowrap overflow-hidden text-ellipsis">{event.action}</div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="opacity-70 text-xs whitespace-nowrap">
                      [{new Date(event.timestamp * 1000).toLocaleTimeString()}]
                    </span>
                    {event.position && (
                      <>
                        <ViewOnMapIcon hideTooltip={true} position={event.position} />
                        <NavigateToPositionIcon hideTooltip={true} position={event.position} />
                      </>
                    )}
                    <MessageIcon playerName={event.name} selectedPlayer={event.address ?? BigInt(0)} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};
