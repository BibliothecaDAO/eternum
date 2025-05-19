import { getAddressFromStructureEntity, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, ID, world } from "@bibliothecadao/types";
import { Component, defineComponentSystem, Entity, getComponentValue, World } from "@dojoengine/recs";
import { useCallback, useEffect, useState } from "react";
import { shortString } from "starknet";
import { EVENT_NOTIF_STORAGE_KEY, EVENT_STREAM_SIZE } from "./constants";
import { eventDetails } from "./event-details";
import { EventData, EventType } from "./types";

export const EventStream = ({ hideChat }: { hideChat: boolean }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const [eventList, setEventList] = useState<EventData[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "personal">("all");
  const [hasNewEvents, setHasNewEvents] = useState(false);

  const createEvent = useCallback(
    (entity: Entity, component: Component<any>, eventType: EventType): EventData | undefined => {
      const componentValue = getComponentValue(component, entity);

      console.log(componentValue);

      const owner = undefined;

      const to = eventDetails[eventType].to?.(componentValue! as any, (id: ID) =>
        getAddressFromStructureEntity(id, components),
      );

      const isPersonal = to === ContractAddress(account.address);

      const name = shortString.decodeShortString(
        getComponentValue(components.AddressName, getEntityIdFromKeys([BigInt(to ?? 0)]))?.name.toString() ?? "",
      );

      return {
        to,
        action: eventDetails[eventType].getAction(componentValue! as any, isPersonal),
        name: name,
        eventType,
        timestamp: componentValue?.timestamp || 0,
        position: { x: 0, y: 0 },
        address: owner,
        entityId: entity,
      };
    },
    [account.address, components],
  );

  const createEventStream = (world: World, eventType: EventType) => {
    const component = components.events[eventType as keyof typeof components.events] as Component<any>;

    defineComponentSystem(
      world,
      component,
      (update) => {
        const event = createEvent(update.entity, component, eventType);
        if (!event) return;
        setEventList((prev) => {
          const eventExists = prev.some((e) => e.entityId === event.entityId && e.timestamp === event.timestamp);
          if (eventExists) {
            return prev;
          }

          const newEvents = [event, ...prev];
          if (event.to === ContractAddress(account.address)) {
            const lastSeen = localStorage.getItem(EVENT_NOTIF_STORAGE_KEY) || "0";
            if (event.timestamp > parseInt(lastSeen)) {
              setHasNewEvents(true);
            }
          }
          return newEvents.slice(0, EVENT_STREAM_SIZE * 2);
        });
      },
      { runOnInit: true },
    );
  };

  useEffect(() => {
    Object.keys(eventDetails).forEach((eventType) => {
      createEventStream(world, eventType as EventType);
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
    <div className={`w-full pointer-events-auto flex flex-col ${hideChat ? "h-0 hidden" : "h-full"}`}>
      <div
        className={`flex flex-row text-xs text-center md:justify-start justify-end flex-shrink-0 ${hideChat ? "hidden" : "h-[2rem]"}`}
      >
        <div className="flex ml-2 h6 pb-0.5">
          <div
            className={`px-3 cursor-pointer ${activeTab === "all" ? "bg-brown/40 text-gold" : "bg-brown/20"}`}
            onClick={() => setActiveTab("all")}
          >
            All
          </div>
          <div
            className={`px-3 cursor-pointer relative ${
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
      </div>

      <div
        className={`bg-brown/90 px-2 text-xs rounded-tr border border-gold/40 overflow-y-auto ${hideChat ? "hidden" : "flex-grow"}`}
      >
        {filteredEvents
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-EVENT_STREAM_SIZE)
          .map((event) => {
            const { emoji, color } = eventDetails[event.eventType as keyof typeof eventDetails];
            return (
              <div
                className={`hover:bg-brown/20 w-full rounded flex flex-row justify-between text-xs `}
                style={{ color }}
                key={`${event.entityId}-${event.timestamp}`}
              >
                <div className="flex items-center space-x-2 flex-grow overflow-hidden">
                  <span className="text-lg flex-shrink-0" style={{ fill: color }}>
                    {emoji}
                  </span>
                  <span className="whitespace-nowrap flex-shrink-0">[{event.name || "Unknown"}]:</span>
                  <div className="whitespace-nowrap overflow-hidden text-ellipsis">{event.action}</div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0 ml-6 md:ml-0">
                  <span className="opacity-70 text-xs whitespace-nowrap">
                    [{new Date(event.timestamp * 1000).toLocaleTimeString()}]
                  </span>
                  {/* {event.position && (
                    <div className="hidden md:flex">
                      <ViewOnMapIcon hideTooltip={true} position={new Position(event.position)} />
                      <NavigateToPositionIcon hideTooltip={true} position={new Position(event.position)} />
                    </div>
                  )} */}
                  {/* <div className="hidden md:block">
                    <MessageIcon playerName={event.name} selectedPlayer={event.address ?? BigInt(0)} />
                  </div> */}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};
