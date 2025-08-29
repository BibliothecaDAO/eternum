import { ArmyCreationDrawer } from "@/features/armies";
import { getTierStyle } from "@/shared/lib/tier-styles";
import { cn } from "@/shared/lib/utils";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { divideByPrecision, getTroopResourceId } from "@bibliothecadao/eternum";
import { DEFENSE_NAMES, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { Clock, Edit, Plus, Shield } from "lucide-react";
import { useState } from "react";

export interface DefenseTroop {
  slot: number;
  troops: {
    category: string | null;
    tier: string | null;
    count: bigint;
    stamina: {
      amount: bigint;
      updated_tick: bigint;
    };
  } | null;
}

interface DefenseSlotsProps {
  maxDefenses: number;
  troops: DefenseTroop[];
  cooldownSlots?: { slot: number; timeLeft: number }[];
  structureId?: ID;
  className?: string;
  onDefenseUpdated?: () => void;
}

const CooldownTimer = ({ timeLeft }: { timeLeft: number }) => {
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const timeString = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-2 text-yellow-500">
      <Clock className="w-4 h-4" />
      <span className="text-sm font-mono">{timeString}</span>
    </div>
  );
};

export function DefenseSlots({
  maxDefenses,
  troops,
  cooldownSlots = [],
  structureId,
  className,
  onDefenseUpdated,
}: DefenseSlotsProps) {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSlotClick = (index: number) => {
    if (!structureId) return;

    const cooldown = cooldownSlots.find((c) => c.slot === index);
    if (cooldown) return; // Don't allow editing during cooldown

    setSelectedSlot(index);
    setIsDrawerOpen(true);
  };

  const handleDefenseSuccess = () => {
    setIsDrawerOpen(false);
    setSelectedSlot(null);
    onDefenseUpdated?.();
  };

  const getExistingDefense = (slotIndex: number) => {
    return troops.find((t) => t.slot === slotIndex);
  };
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Defenses</h3>
      </div>

      <div className="space-y-2">
        {Array.from({ length: maxDefenses }).map((_, index) => {
          const defense = troops.find((t) => t.slot === index);
          const cooldown = cooldownSlots.find((c) => c.slot === index);
          const defenseName = DEFENSE_NAMES[index as keyof typeof DEFENSE_NAMES];

          return (
            <div
              key={index}
              className={cn(
                "border rounded-lg p-3 transition-all",
                defense && defense.troops && defense.troops.count > 0n
                  ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-gray-500/10 border-gray-500/20",
                structureId && !cooldown && "cursor-pointer hover:border-blue-500/40 active:scale-[0.98]",
              )}
              onClick={() => handleSlotClick(index)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{defenseName}</span>
                <div className="flex items-center gap-2">
                  {cooldown && <CooldownTimer timeLeft={cooldown.timeLeft} />}
                  {structureId && !cooldown && (
                    <div className="flex items-center gap-1">
                      {defense && defense.troops && defense.troops.count > 0n ? (
                        <Edit className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Plus className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {!cooldown && defense && defense.troops && defense.troops.count > 0n ? (
                <div className="flex items-center justify-between">
                  <ResourceAmount
                    resourceId={getTroopResourceId(
                      defense.troops!.category as TroopType,
                      defense.troops!.tier as TroopTier,
                    )}
                    amount={divideByPrecision(Number(defense.troops!.count), false)}
                    size="lg"
                    showName={true}
                  />
                  <span
                    className={cn(
                      "px-2 py-1 text-xs font-bold border rounded",
                      getTierStyle(defense.troops!.tier || ""),
                    )}
                  >
                    {defense.troops!.tier}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">
                    {cooldown ? "On cooldown" : structureId ? "Tap to add defense" : "Empty slot"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Army Creation Drawer */}
      {structureId && selectedSlot !== null && (
        <ArmyCreationDrawer
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          structureId={structureId}
          defenseSlot={selectedSlot}
          existingDefense={getExistingDefense(selectedSlot)}
          onSuccess={handleDefenseSuccess}
        />
      )}
    </div>
  );
}
