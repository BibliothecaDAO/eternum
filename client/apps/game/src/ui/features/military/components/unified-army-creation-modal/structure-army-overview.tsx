import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { Shield, Swords } from "lucide-react";

import type { TroopSelectionOption } from "./types";

interface StructureArmyOverviewProps {
  structureName?: string;
  attackCount: number;
  maxAttack: number;
  defenseCount: number;
  maxDefense: number;
  troopOptions: TroopSelectionOption[];
}

const formatTroopLabel = (label: string, tier: number) => `${label} T${tier}`;

export const StructureArmyOverview = ({
  structureName,
  attackCount,
  maxAttack,
  defenseCount,
  maxDefense,
  troopOptions,
}: StructureArmyOverviewProps) => {
  const availableTroops = troopOptions
    .flatMap((option) =>
      option.tiers
        .filter((tier) => tier.available > 0)
        .map((tier) => ({
          key: `${option.type}-${tier.tier}`,
          label: formatTroopLabel(option.label, tier.tier),
          available: tier.available,
          resourceTrait: tier.resourceTrait,
        })),
    )
    .sort((a, b) => b.available - a.available);

  const topTroops = availableTroops.slice(0, 3);
  const totalTroops = availableTroops.reduce((sum, troop) => sum + troop.available, 0);

  return (
    <div className="panel-wood rounded-xl p-4 border border-brown/40 space-y-4">
      <div>
        <h3 className="text-gold text-lg font-bold leading-tight">
          {structureName ?? "Select a structure"}
        </h3>
        <p className="text-xs text-gold/60">Active structure summary</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 bg-brown/30 rounded-lg px-3 py-2">
          <Swords className="w-5 h-5 text-gold" />
          <div>
            <p className="text-xs text-gold/60 uppercase tracking-wide">Attack Armies</p>
            <p className="text-sm font-semibold text-gold">
              {attackCount} / {maxAttack}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-brown/30 rounded-lg px-3 py-2">
          <Shield className="w-5 h-5 text-gold" />
          <div>
            <p className="text-xs text-gold/60 uppercase tracking-wide">Defenses</p>
            <p className="text-sm font-semibold text-gold">
              {defenseCount} / {maxDefense}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-brown/25 border border-brown/30 rounded-lg px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gold/80 uppercase tracking-wide">Top Troops Ready</h4>
          <span className="text-xs text-gold/60">Total {totalTroops.toLocaleString()}</span>
        </div>
        {topTroops.length > 0 ? (
          <div className="space-y-2">
            {topTroops.map((troop) => (
              <div
                key={troop.key}
                className="flex items-center justify-between rounded-lg bg-brown/20 px-2 py-1"
              >
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={troop.resourceTrait} size="xs" withTooltip={false} />
                  <span className="text-xs font-semibold text-gold/90">{troop.label}</span>
                </div>
                <span className="text-xs text-gold/70 font-medium">{troop.available.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gold/50">No troops available yet.</p>
        )}
      </div>
    </div>
  );
};
