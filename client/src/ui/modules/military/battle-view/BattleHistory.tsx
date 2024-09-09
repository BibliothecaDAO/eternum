import { ClientComponents } from "@/dojo/createClientComponents";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useBattleJoin, useBattleLeave, useBattleStart } from "@/hooks/helpers/useBattleEvents";
import { currencyFormat, formatElapsedTime } from "@/ui/utils/utils";
import { BattleSide, ID } from "@bibliothecadao/eternum";
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
}

const EVENT_CONFIG = {
  [EventType.BattleLeave]: { action: "left the battle", emoji: "🏃", className: "" },
  [EventType.BattleJoin]: { action: "joined the battle", emoji: "⚔️", className: "" },
  [EventType.BattleStart]: { action: "started the battle", emoji: "⚔️", className: "font-bold" },
};

export const BattleHistory = ({ battleId, battleSide }: { battleId: ID; battleSide: BattleSide }) => {
  const battleStartData = useBattleStart(battleId);
  const battleJoinData = useBattleJoin(battleId, battleSide);
  const battleLeaveData = useBattleLeave(battleId, battleSide);

  const { getArmy } = getArmyByEntityId();

  const events = useMemo(() => {
    return [...(battleSide === BattleSide.Attack ? battleStartData : []), ...battleJoinData, ...battleLeaveData].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }, [battleStartData, battleJoinData, battleLeaveData]);

  const battleStartTime = battleStartData?.[0]?.timestamp;

  return (
    <div
      className={`px-4 pt-4 col-span-2 p-2 border-l-4 border-r-4 border-gold/20 w-full overflow-y-auto max-h-[35vh] h-full no-scrollbar text-left`}
    >
      {events.map((event) => {
        let doerName;
        let doerArmyEntityId: ID;
        if (event.event_id === EventType.BattleLeave) {
          const battleLeaveData = event as BattleLeaveData;
          doerName = battleLeaveData.leaver_name;
          doerArmyEntityId = battleLeaveData.leaver_army_entity_id;
        } else if (event.event_id === EventType.BattleJoin) {
          const battleJoinData = event as BattleJoinData;
          doerName = battleJoinData.joiner_name;
          doerArmyEntityId = battleJoinData.joiner_army_entity_id;
        } else if (event.event_id === EventType.BattleStart) {
          const battleStartData = event as BattleStartData;
          doerName = battleStartData.attacker_name;
          doerArmyEntityId = battleStartData.attacker_army_entity_id;
        } else {
          doerName = "";
          doerArmyEntityId = 0;
        }

        const { emoji, action, className } = EVENT_CONFIG[event.event_id as keyof typeof EVENT_CONFIG];

        const doerArmy = getArmy(doerArmyEntityId);

        const elapsedTime = event.timestamp - battleStartTime;

        return React.Children.toArray(
          <div className={`flex flex-col mb-4 ${className}`}>
            <div className={`grid grid-cols-4 gap-4`}>
              <div className="italic text-xs col-span-1 align-middle self-center">
                {event.event_id !== EventType.BattleStart ? `${formatElapsedTime(elapsedTime)} since start` : ""}
              </div>
              <div className="col-span-3 align-middle self-center" key={event.id}>
                {emoji} {shortString.decodeShortString(doerName.toString())} {action} with{" "}
                {currencyFormat(getTotalTroops(doerArmy), 0)} troops
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

const getTotalTroops = (army: ArmyInfo | undefined): number => {
  if (!army) return 0;
  const { knight_count, paladin_count, crossbowman_count } = army.troops;
  return Number(knight_count + paladin_count + crossbowman_count);
};
