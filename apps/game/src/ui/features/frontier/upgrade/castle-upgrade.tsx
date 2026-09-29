import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { buildableRadius } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { BUILDINGS_CENTER } from "@bibliothecadao/types";
import type { UpgradePlan, UpgradeStep } from "./upgrade-plan";
import { UpgradeSheet } from "./upgrade-sheet";

const CASTLE_ART = ["castleZero", "castleOne", "castleTwo", "castleThree"].map(
  (name) => `/images/buildings/construction/${name}.png`,
);
const PLOT_ICON = "/image-icons/ui-hexagon.png";

/** Whether the player tapped their own realm's keep in the realm view. */
export const useKeepSelected = (realm: NativeRows["Structure"] | null): boolean => {
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  return (
    !isMapView &&
    ordersAllowed &&
    realm !== null &&
    selected?.structureId === realm.entity_id &&
    selected.innerCol === BUILDINGS_CENTER[0] &&
    selected.innerRow === BUILDINGS_CENTER[1]
  );
};

/** The upgrade sheet on the keep: the castle's next level, and the ring of plots it opens. */
export const CastleUpgrade = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const castle = useCastleUpgradePlan(realm);
  return castle && <UpgradeSheet plan={castle.plan} upgrade={castle.upgrade} onClose={onClose} />;
};

/**
 * The keep's upgrade as the upgrade sheet draws it, from the realm's level facts and the game's upgrade recipe: the
 * castle now and at its next level, each with the building plots its ring opens, and the price.
 */
const useCastleUpgradePlan = (
  realm: NativeRows["Structure"],
): { plan: UpgradePlan; upgrade: () => Promise<void> } | null => {
  const upgrade = useStructureUpgrade(realm.entity_id);
  if (!upgrade) return null;
  return {
    plan: {
      name: upgrade.currentLevelName,
      doubled: false,
      population: undefined,
      now: castleStep(upgrade.currentLevel),
      next: upgrade.nextLevel === null ? null : castleStep(upgrade.nextLevel),
      price: upgrade.requirements.map(({ resource, amount }) => ({ resource, amount })),
      affordable: upgrade.canUpgrade,
    },
    upgrade: upgrade.handleUpgrade,
  };
};

const castleStep = (level: number): UpgradeStep => {
  const art = CASTLE_ART[level];
  if (!art) throw new Error(`No castle art for level ${level}`);
  return {
    art,
    tier: (level + 1) as UpgradeStep["tier"],
    gain: { icon: PLOT_ICON, value: ringPlots(buildableRadius(level)), perHour: false },
  };
};

/** The building plots a castle's rings open: every hex within its radius but the keep's own, 3r(r + 1). */
const ringPlots = (radius: number): number => 3 * radius * (radius + 1);
