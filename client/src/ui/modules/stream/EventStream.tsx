import { ReactComponent as Check } from "@/assets/icons/Check.svg";
import { ReactComponent as Chest } from "@/assets/icons/Chest.svg";
import { ReactComponent as Coins } from "@/assets/icons/Coins.svg";
import { ReactComponent as Combat } from "@/assets/icons/Combat.svg";
import { ReactComponent as Minimize } from "@/assets/icons/common/minimize.svg";
import { ReactComponent as Compass } from "@/assets/icons/Compass.svg";
import { ReactComponent as Crown } from "@/assets/icons/Crown.svg";
import { ReactComponent as Burn } from "@/assets/icons/fire.svg";
import { ReactComponent as Scroll } from "@/assets/icons/Scroll.svg";
import { ReactComponent as Sparkles } from "@/assets/icons/Sparkles.svg";
import { ReactComponent as Swap } from "@/assets/icons/Swap.svg";
import { ReactComponent as Wrench } from "@/assets/icons/Wrench.svg";
import { ClientComponents } from "@/dojo/createClientComponents";
import { world } from "@/dojo/world";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { NavigateToPositionIcon } from "@/ui/components/military/ArmyChip";
import { ViewOnMapIcon } from "@/ui/components/military/ArmyManagementCard";
import { currencyFormat } from "@/ui/utils/utils";
import { ContractAddress, findResourceById, ID, Position } from "@bibliothecadao/eternum";
import { Component, ComponentValue, defineComponentSystem, getComponentValue, World } from "@dojoengine/recs";
import { getEntityIdFromKeys, hexToAscii } from "@dojoengine/utils";
import { useEffect, useState } from "react";
import { MessageIcon } from "../social/PlayerId";

const EVENT_STREAM_SIZE = 8;

enum EventType {
  BurnDonkey = "BurnDonkey",
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

const EVENT_CONFIG: {
  [key in EventType]: {
    to?: (
      compononentValue: ComponentValue<ClientComponents["events"][key]["schema"]>,
      getAddressFromEntity: (id: ID) => ContractAddress | undefined,
    ) => ContractAddress | undefined;
    getAction: (componentValue: ComponentValue<ClientComponents["events"][key]["schema"]>) => string;
    emoji: JSX.Element;
    color: string;
  };
} = {
  [EventType.SettleRealm]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.SettleRealm]["schema"]>) =>
      `settled Realm ${hexToAscii("0x" + componentValue.realm_name.toString(16))}`,
    emoji: <Crown className="w-6 self-center fill-current" />,
    color: "#FFAB91",
  },
  [EventType.BurnDonkey]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.BurnDonkey]["schema"]>) =>
      `burnt ${currencyFormat(Number(componentValue.amount), 0)} donkeys`,
    emoji: <Burn className="w-6 self-center fill-current" />,
    color: "#A5D6A7",
  },
  [EventType.MapExplored]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.MapExplored]["schema"]>) => `explored a tile`,
    emoji: <Compass className="w-6 self-center fill-current" />,
    color: "#ED9733",
  },
  [EventType.BattleStart]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattleStart]["schema"]>,
      _getAddressFromEntity,
    ) => componentValue.defender,
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleStart]["schema"]>) => `started a battle`,
    emoji: <Combat className="w-6 self-center fill-current" />,
    color: "#EF9A9A",
  },
  [EventType.BattleJoin]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleJoin]["schema"]>) => `joined a battle`,
    emoji: <Combat className="w-6 self-center fill-current" />,
    color: "#EF9A9A",
  },
  [EventType.BattleLeave]: {
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.BattleLeave]["schema"]>) => "left a battle",
    emoji: <Scroll className="w-6 self-center fill-current" />,
    color: "#90CAF9",
  },
  [EventType.BattleClaim]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattleClaim]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.structure_entity_id),
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.BattleClaim]["schema"]>) =>
      `claimed a ${componentValue.structure_type}`,
    emoji: <Chest className="w-6 self-center fill-current" />,
    color: "#FFCC80",
  },
  [EventType.BattlePillage]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.BattlePillage]["schema"]>,
      _getAddressFromEntity,
    ) => componentValue.pillaged_structure_owner,
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.BattlePillage]["schema"]>) =>
      `pillaged a ${componentValue.structure_type}`,
    emoji: <Coins className="w-6 self-center fill-current" />,
    color: "#CE93D8",
  },
  [EventType.Swap]: {
    getAction: (componentValue: ComponentValue<ClientComponents["events"][EventType.Swap]["schema"]>) => {
      const buyAmount = componentValue.buy ? componentValue.lords_amount : componentValue.resource_amount;
      const buyResource = componentValue.buy ? "lords" : findResourceById(componentValue.resource_type)?.trait;

      const sellAmount = componentValue.buy ? componentValue.resource_amount : componentValue.lords_amount;
      const sellResource = componentValue.buy ? findResourceById(componentValue.resource_type)?.trait : "lords";
      return `swapped  ${currencyFormat(Number(sellAmount), 0)} ${sellResource} for ${currencyFormat(
        Number(buyAmount),
        0,
      )} ${buyResource}`;
    },
    emoji: <Swap className="w-6 self-center fill-current" />,
    color: "#80DEEA",
  },
  [EventType.HyperstructureFinished]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.HyperstructureFinished]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.hyperstructure_entity_id),
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.HyperstructureFinished]["schema"]>) =>
      `finished a hyperstructure`,
    emoji: <Sparkles className="w-6 self-center fill-current" />,
    color: "#FFF59D",
  },
  [EventType.HyperstructureContribution]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.HyperstructureContribution]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.hyperstructure_entity_id),
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.HyperstructureContribution]["schema"]>) =>
      `contributed to a hyperstructure`,
    emoji: <Wrench className="w-6 self-center fill-current" />,
    color: "#FFD54F",
  },
  [EventType.AcceptOrder]: {
    to: (
      componentValue: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>,
      getAddressFromEntity,
    ) => getAddressFromEntity(componentValue.maker_id),
    getAction: (_: ComponentValue<ClientComponents["events"][EventType.AcceptOrder]["schema"]>) =>
      `accepted a p2p order}`,
    emoji: <Check className="w-6 self-center fill-current" />,
    color: "#C5E1A5",
  },
};

interface EventData {
  to: ContractAddress | undefined;
  name: string | undefined;
  action: string;
  eventType: EventType;
  timestamp: number;
  position: Position | undefined;
  address: ContractAddress | undefined;
}

export const EventStream = () => {
  const {
    setup: { components },
  } = useDojo();

  const [hideEventStream, setHideEventStream] = useState(false);
  const [eventList, setEventList] = useState<EventData[]>([]);
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

    return {
      to: EVENT_CONFIG[eventType].to?.(componentValue! as any, getPlayerAddressFromEntity),
      action: EVENT_CONFIG[eventType].getAction(componentValue! as any),
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
        <div className="bg-brown/10 h-6 w-6 rounded-t">
          <Minimize className="w-4 h-4 fill-gold self-center mx-auto" />
        </div>
      </div>
      {hideEventStream ? (
        <div className="bg-brown/5 p-1 rounded-tr rounded-bl rounded-br border border-black/10 h-full w-full min-w-full">
          Events
        </div>
      ) : (
        <div className="bg-brown/40 bg-hex-bg  rounded-bl-2xl p-1 rounded-tr  border border-gold/40 h-full">
          {eventList
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-EVENT_STREAM_SIZE)
            .map((event, index) => {
              const { emoji, color } = EVENT_CONFIG[event.eventType as keyof typeof EVENT_CONFIG];
              return (
                <div
                  className={`hover:bg-brown/20 w-full rounded flex gap-2 justify-between`}
                  style={{ color: color }}
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
