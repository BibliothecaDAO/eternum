import { ReactComponent as PlusIcon } from "@/assets/icons/common/plus-sign.svg";
import Button from "@/ui/elements/button";
import { ArmyManager, ID, Troops } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { ArmyCreate } from "./army-management-card";
import { TroopChip } from "./troop-chip";

const DEFENSE_NAMES = {
  0: "Inner Keep",
  1: "Castle Wall",
  2: "Outer Bailey",
  3: "Watchtower",
};

export interface DefenseTroop {
  slot: ID;
  troops: Troops;
}

interface StructureDefenceProps {
  maxDefenses: number; // 1-4
  troops: DefenseTroop[];
  cooldownSlots?: number[]; // Slots with active cooldown [1, 4]
  structureId: ID;
}

interface CooldownTimerProps {
  slot: number;
  time: number; // seconds
}

const CooldownTimer = ({ slot, time }: CooldownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(time);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="relative w-full text-gold font-bold">
      <div className="px-3 py-2 bg-brown-900/50 h-full w-full flex flex-row justify-between gap-2 border border-gold/20 rounded-md hover:border-gold/40 transition-colors">
        <div className="flex items-center gap-2">
          <div className="text-xs self-center">{timeString}</div>
        </div>
        <div className="text-xs text-gold/60 self-center uppercase tracking-wider">Cooldown (WIP)</div>
      </div>
    </div>
  );
};

export const StructureDefence = ({ maxDefenses, troops, cooldownSlots = [], structureId }: StructureDefenceProps) => {
  const [defenseTroops, setDefenseTroops] = useState(troops);
  const [originalOrder, setOriginalOrder] = useState<DefenseTroop[]>([]);
  const [isReordering, setIsReordering] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  const dojo = useDojo();
  const armyManager = new ArmyManager(dojo.setup.network.provider, dojo.setup.components, structureId);

  useEffect(() => {
    setDefenseTroops(troops);
  }, [troops]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    if (!isReordering) {
      setOriginalOrder([...defenseTroops]);
      setIsReordering(true);
    }

    const items = Array.from(defenseTroops);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setDefenseTroops(items);
  };

  const handleConfirm = () => {
    console.log("New defense order confirmed:", defenseTroops);
    setIsReordering(false);
  };

  const handleCancel = () => {
    setDefenseTroops(originalOrder);
    setIsReordering(false);
  };

  const toggleDefenseExpansion = (index: number) => {
    setExpandedSlot(expandedSlot === index ? null : index);
  };

  // Convert DefenseTroop to ArmyInfo-like structure for ArmyCreate
  const getArmyInfoForSlot = (slot: number) => {
    const defense = defenseTroops.find((d) => d.slot === slot);

    return defense
      ? {
          entityId: defense.slot,
          troops: defense.troops,
          isHome: true,
          name: DEFENSE_NAMES[slot as keyof typeof DEFENSE_NAMES],
        }
      : undefined;
  };

  return (
    <div className="p-3 bg-brown-900/80 rounded-lg border border-gold/10">
      <div className="flex justify-end">
        {isReordering && (
          <div className="flex gap-1.5">
            <Button variant="primary" onClick={handleConfirm} className="px-3 py-0.5 text-xs">
              Confirm Order
            </Button>
            <Button variant="secondary" onClick={handleCancel} className="px-3 py-0.5 text-xs">
              Cancel
            </Button>
          </div>
        )}
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="defenses">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5">
              {Array.from({ length: maxDefenses }).map((_, index) => {
                const defense = defenseTroops[index];
                const slot = defense?.slot;
                const isExpanded = expandedSlot === index;

                return (
                  <div key={slot || `empty-${index}`} className="mb-2">
                    <Draggable
                      key={slot || `empty-${index}`}
                      draggableId={`slot-${slot || `empty-${index}`}`}
                      index={index}
                      isDragDisabled={!defense || cooldownSlots.includes(index) || isExpanded}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center gap-3 p-1.5 rounded-md transition-colors ${
                            snapshot.isDragging
                              ? "bg-brown-800/90"
                              : isExpanded
                                ? "bg-brown-800/70"
                                : "hover:bg-brown-800/50"
                          }`}
                        >
                          <div className="w-28 flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-gold/40" />
                            <div className="text-xs text-gold/80 font-medium">
                              {DEFENSE_NAMES[index as keyof typeof DEFENSE_NAMES]}
                            </div>
                          </div>

                          <div className="flex-1 relative">
                            {cooldownSlots.includes(index) ? (
                              <CooldownTimer slot={index} time={24 * 60 * 60} />
                            ) : defense ? (
                              <div className="relative">
                                <TroopChip
                                  troops={defense.troops}
                                  iconSize="sm"
                                  className="flex-1 hover:border-gold/40 transition-colors"
                                />
                                <button
                                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 ${
                                    isExpanded ? "bg-gold/40" : "bg-gold/20 hover:bg-gold/40"
                                  } rounded-full p-1 transition-colors`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDefenseExpansion(index);
                                  }}
                                >
                                  <PlusIcon className="w-4 h-4 fill-gold" />
                                </button>
                              </div>
                            ) : (
                              <div
                                className="flex-1 px-3 py-2 bg-brown-900/50 border border-gold/20 rounded-md text-gold/40 text-xs hover:border-gold/40 transition-colors flex justify-between items-center cursor-pointer"
                                onClick={() => toggleDefenseExpansion(index)}
                              >
                                <span>Empty Defense Slot</span>
                                <PlusIcon className="w-4 h-4 fill-gold" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>

                    {isExpanded && (
                      <div className="mt-2 p-3 bg-brown-800/50 border border-gold/20 rounded-md">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="text-gold font-bold text-sm">
                            {defense ? "Update Defense" : "Add Defense"}:{" "}
                            {DEFENSE_NAMES[index as keyof typeof DEFENSE_NAMES]}
                          </h3>
                          <Button
                            variant="secondary"
                            onClick={() => setExpandedSlot(null)}
                            className="px-2 py-1 text-xs"
                          >
                            Close
                          </Button>
                        </div>

                        <ArmyCreate
                          owner_entity={structureId}
                          army={getArmyInfoForSlot(index) as any}
                          armyManager={armyManager}
                          isExplorer={false}
                          guardSlot={index}
                          onCancel={() => setExpandedSlot(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
