import Button from "@/ui/elements/button";
import { ID, Troops } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";
import { TroopChip } from "./troop-chip";

const DEFENSE_NAMES = {
  0: "Inner Keep",
  1: "Castle Wall",
  2: "Outer Bailey",
  3: "Watchtower",
};

interface DefenseTroop {
  id: ID;
  troops: Troops;
}

interface StructureDefenceProps {
  maxDefenses: number; // 1-4
  troops: DefenseTroop[];
  cooldownSlots?: number[]; // Slots with active cooldown [1, 4]
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
        <div className="text-xs text-gold/60 self-center uppercase tracking-wider">Cooldown</div>
      </div>
    </div>
  );
};

export const StructureDefence = ({ maxDefenses, troops, cooldownSlots = [] }: StructureDefenceProps) => {
  const [defenseTroops, setDefenseTroops] = useState(troops);
  const [originalOrder, setOriginalOrder] = useState<DefenseTroop[]>([]);
  const [isReordering, setIsReordering] = useState(false);

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

  return (
    <div className="p-3 bg-brown-900/80 rounded-lg border border-gold/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gold text-base font-semibold">Structure Defenses</h3>
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
                const id = defense?.id;

                return (
                  <Draggable
                    key={id}
                    draggableId={`slot-${id}`}
                    index={index}
                    isDragDisabled={!defense || cooldownSlots.includes(index)}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`flex items-center gap-3 p-1.5 rounded-md transition-colors ${
                          snapshot.isDragging ? "bg-brown-800/90" : "hover:bg-brown-800/50"
                        }`}
                      >
                        <div className="w-28 flex items-center gap-1.5">
                          <div className="w-1 h-1 rounded-full bg-gold/40" />
                          <div className="text-xs text-gold/80 font-medium">
                            {DEFENSE_NAMES[index as keyof typeof DEFENSE_NAMES]}
                          </div>
                        </div>

                        <div className="flex-1">
                          {cooldownSlots.includes(index) ? (
                            <CooldownTimer slot={index} time={24 * 60 * 60} />
                          ) : defense ? (
                            <TroopChip
                              troops={defense.troops}
                              iconSize="sm"
                              className="flex-1 hover:border-gold/40 transition-colors"
                            />
                          ) : (
                            <div className="flex-1 px-3 py-2 bg-brown-900/50 border border-gold/20 rounded-md text-gold/40 text-xs hover:border-gold/40 transition-colors">
                              Empty Defense Slot
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
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
