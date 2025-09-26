import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { Shield, Swords, Package } from "lucide-react";

import type { TroopSelectionOption } from "./types";

interface StructureArmyOverviewProps {
  structureName?: string;
  coordinates?: { x: number; y: number } | null;
  attackCount: number;
  maxAttack: number;
  defenseCount: number;
  maxDefense: number;
  troopOptions: TroopSelectionOption[];
}

const formatTroopLabel = (typeLabel: string, tier: number) => `${typeLabel} T${tier}`;

export const StructureArmyOverview = ({
  structureName,
  coordinates,
  attackCount,
  maxAttack,
  defenseCount,
  maxDefense,
  troopOptions,
}: StructureArmyOverviewProps) => {
  const availableTroops = troopOptions.flatMap((option) =>
    option.tiers
      .filter((tier) => tier.available > 0)
      .map((tier) => ({
        key: `${option.type}-${tier.tier}`,
        label: formatTroopLabel(option.label, tier.tier),
        available: tier.available,
        resourceTrait: tier.resourceTrait,
      })),
  );

  return (
    <div className="panel-wood rounded-xl p-4 border border-brown/40 space-y-4">
      <div>
        <h3 className="text-gold text-lg font-bold leading-tight">
          {structureName ?? "Select a structure"}
        </h3>
        {coordinates && (
          <p className="text-xs text-gold/60">Location: {coordinates.x}, {coordinates.y}</p>
        )}
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

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-4 h-4 text-gold" />
          <h4 className="text-sm font-semibold text-gold/80 uppercase tracking-wide">Troops in Inventory</h4>
        </div>
        {availableTroops.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            {availableTroops.map((troop) => (
              <div
                key={troop.key}
                className="flex items-center justify-between bg-brown/25 border border-brown/40 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <ResourceIcon resource={troop.resourceTrait} size="sm" withTooltip={false} />
                  <span className="text-sm font-semibold text-gold">{troop.label}</span>
                </div>
                <span className="text-sm text-gold/80 font-medium">{troop.available.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gold/60 bg-brown/20 border border-brown/30 rounded-lg px-3 py-3">
            No troops available in this structure's inventory.
          </div>
        )}
      </div>
    </div>
  );
};
