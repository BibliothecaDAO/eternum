import type { UpgradePlan } from "@/ui/features/frontier/upgrade/upgrade-plan";
import { UpgradeSheet } from "@/ui/features/frontier/upgrade/upgrade-sheet";
import { ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";

/**
 * A farm on the ring's marked plot going from tier I to II, as mockup 1 draws it. A lab fixture only: the live sheet
 * reads Building.tier and BuildingTierRule once the tier facts land; the keep's upgrade is live already.
 */
const FARM_PLAN: UpgradePlan = {
  name: "Farm",
  doubled: true,
  population: 1,
  now: {
    art: "/images/buildings/construction/farm.png",
    tier: 1,
    gain: { icon: `/images/resources/${ResourcesIds.Wheat}.png`, value: 600, perHour: true },
  },
  next: {
    art: "/images/buildings/construction/farm.png",
    tier: 2,
    gain: { icon: `/images/resources/${ResourcesIds.Wheat}.png`, value: 1_200, perHour: true },
  },
  price: [{ resource: ResourcesIds.Labor, amount: 200 }],
  affordable: true,
};

export const UpgradeLab = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-lg border border-gold/40 px-3 text-sm"
      >
        Open farm upgrade
      </button>
      {open && (
        <UpgradeSheet
          plan={FARM_PLAN}
          onClose={() => setOpen(false)}
          upgrade={() => new Promise((resolve) => window.setTimeout(resolve, 500))}
        />
      )}
    </div>
  );
};
