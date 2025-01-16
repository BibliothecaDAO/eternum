import { useDojo } from "@/hooks/context/dojo-context";
import { useBattleJoin, useBattleLeave, useBattleStart } from "@/hooks/helpers/use-battle-events";
import { currencyFormat, formatTime } from "@/ui/utils/utils";
import { getArmy } from "@/utils/army";
import { BattleSide, ClientComponents, ContractAddress, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import React, { useMemo } from "react";
import { shortString } from "starknet";

type BattleLeaveData = ComponentValue<ClientComponents["events"]["BattleLeaveData"]["schema"]>;
type BattleJoinData = ComponentValue<ClientComponents["events"]["BattleJoinData"]["schema"]>;
type BattleStartData = ComponentValue<ClientComponents["events"]["BattleStartData"]["schema"]>;

enum EventType {
  BattleLeave = "BattleLeave",
  BattleJoin = "BattleJoin",
  BattleStart = "BattleStart",
  BattleAttacked = "BattleAttacked",
}

const EVENT_CONFIG = {
  [EventType.BattleLeave]: { action: "left the battle with", emoji: "🏃", className: "" },
  [EventType.BattleJoin]: { action: "joined the battle with", emoji: "⚔️", className: "" },
  [EventType.BattleStart]: { action: "started the battle with", emoji: "⚔️", className: "font-bold" },
  [EventType.BattleAttacked]: { action: "was attacked and had", emoji: "⚔️", className: "font-bold" },
};

export const BattleHistory = ({ battleId, battleSide }: { battleId: ID; battleSide: BattleSide }) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const battleStartData = useBattleStart(battleId);
  const battleJoinData = useBattleJoin(battleId, battleSide);
  const battleLeaveData = useBattleLeave(battleId, battleSide);

  const events = useMemo(() => {
    return [...battleStartData, ...battleJoinData, ...battleLeaveData].sort(
      (a, b) => (a?.timestamp || 0) - (b?.timestamp || 0),
    );
  }, [battleStartData, battleJoinData, battleLeaveData]);

  const battleStartTime = battleStartData?.[0]?.timestamp || 0;

  return (
    <div className={`self-center px-4 pt-4 col-span-2 p-2 w-full overflow-y-auto no-scrollbar text-left`}>
      {events.map((event) => {
        if (!event) return null;
        const eventClone = structuredClone(event);
        let doerName;
        let doerArmyEntityId: ID;
        if (eventClone.event_id === EventType.BattleLeave) {
          const battleLeaveData = eventClone as BattleLeaveData;
          doerName = battleLeaveData.leaver_name;
          doerArmyEntityId = battleLeaveData.leaver_army_entity_id;
        } else if (eventClone.event_id === EventType.BattleJoin) {
          const battleJoinData = eventClone as BattleJoinData;
          doerName = battleJoinData.joiner_name;
          doerArmyEntityId = battleJoinData.joiner_army_entity_id;
        } else if (eventClone.event_id === EventType.BattleStart) {
          const battleStartData = eventClone as BattleStartData;
          if (battleSide === BattleSide.Attack) {
            doerName = battleStartData.attacker_name;
            doerArmyEntityId = battleStartData.attacker_army_entity_id;
          } else {
            eventClone.event_id = EventType.BattleAttacked;
            doerName = battleStartData.defender_name;
            doerArmyEntityId = battleStartData.defender_army_entity_id;
          }
        } else {
          doerName = 0n;
          doerArmyEntityId = 0;
        }

        const doerArmy = useMemo(
          () => getArmy(doerArmyEntityId, ContractAddress(account.address), components),
          [doerArmyEntityId, account.address, components],
        );

        const armyName = doerName === 0n ? "Mercenaries" : shortString.decodeShortString(doerName.toString());
        const elapsedTime = eventClone.timestamp - battleStartTime;

        const { emoji, action, className } = EVENT_CONFIG[eventClone.event_id as keyof typeof EVENT_CONFIG];
        return React.Children.toArray(
          <div className={`flex flex-col my-4 ${className}`}>
            <div className={`grid grid-cols-4 gap-4`}>
              <div className="h-full italic text-xs col-span-1 align-top self-start mt-1.5">
                {eventClone.event_id !== EventType.BattleStart && eventClone.event_id !== EventType.BattleAttacked
                  ? `${formatTime(elapsedTime)} since start`
                  : "Battle started"}
              </div>
              <div className="col-span-3 align-top self-start" key={eventClone.id}>
                {emoji} {armyName} {action} {currencyFormat(getTotalTroops(doerArmy?.troops), 0)} troops
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1"></div>
              <div className="col-span-3"></div>
            </div>
          </div>,
        );
      })}
    </div>
  );
};

export const getTotalTroops = (
  troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined,
): number => {
  if (!troops) return 0;
  const { knight_count, paladin_count, crossbowman_count } = troops;
  return Number(knight_count + paladin_count + crossbowman_count);
};
