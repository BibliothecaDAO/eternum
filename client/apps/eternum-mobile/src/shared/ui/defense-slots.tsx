import { getTierStyle } from "@/shared/lib/tier-styles";
import { cn } from "@/shared/lib/utils";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { divideByPrecision, getTroopResourceId } from "@bibliothecadao/eternum";
import { DEFENSE_NAMES, TroopTier, TroopType } from "@bibliothecadao/types";
import { Clock, Shield } from "lucide-react";

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
  };
}

interface DefenseSlotsProps {
  maxDefenses: number;
  troops: DefenseTroop[];
  cooldownSlots?: { slot: number; timeLeft: number }[];
  className?: string;
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

export function DefenseSlots({ maxDefenses, troops, cooldownSlots = [], className }: DefenseSlotsProps) {
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
                "border rounded-lg p-3",
                defense && defense.troops.count > 0n
                  ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-gray-500/10 border-gray-500/20",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">{defenseName}</span>
                {cooldown && <CooldownTimer timeLeft={cooldown.timeLeft} />}
              </div>

              {!cooldown && defense && defense.troops.count > 0n ? (
                <div className="flex items-center justify-between">
                  <ResourceAmount
                    resourceId={getTroopResourceId(
                      defense.troops.category as TroopType,
                      defense.troops.tier as TroopTier,
                    )}
                    amount={divideByPrecision(Number(defense.troops.count), false)}
                    size="lg"
                    showName={true}
                  />
                  <span
                    className={cn(
                      "px-2 py-1 text-xs font-bold border rounded",
                      getTierStyle(defense.troops.tier || ""),
                    )}
                  >
                    {defense.troops.tier}
                  </span>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground py-2">{cooldown ? "On cooldown" : "Empty slot"}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
