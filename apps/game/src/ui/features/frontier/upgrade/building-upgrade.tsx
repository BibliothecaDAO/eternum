import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { getBalance, isRealmMarkedPlot, researchedBuildingTier } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import {
  BUILDINGS_CENTER,
  type BuildingType,
  type HexPosition,
  RESOURCE_PRECISION,
  ResourcesIds,
} from "@bibliothecadao/types";
import { useMemo } from "react";
import type { Account } from "starknet";
import { readBuildingEffect } from "../build/build-options";
import { FRONTIER_BUILDING_NAMES } from "../build/building-names";
import { effectGain } from "../build/effect-gain";
import type { UpgradePlan, UpgradeStep } from "./upgrade-plan";
import { UpgradeSheet } from "./upgrade-sheet";

const UPGRADE_MODELS = [
  "Building",
  "BuildingRule",
  "BuildingTierRule",
  "RealmKnowledge",
  "ResearchNode",
  "ResourceBalance",
  "ResourceProduction",
] as const;

/** The building on the plot of the player's realm they tapped in the realm view, if one stands there. */
export const useSelectedBuilding = (
  realm: NativeRows["Structure"] | null,
): { building: NativeRows["Building"]; plot: HexPosition } | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selected = useUIStore((state) => state.selectedBuildingHex);
  const ordersAllowed = useUIStore(canIssueOrders);
  useNativeRevision(["Building"]);
  if (isMapView || !ordersAllowed || !realm || selected?.structureId !== realm.entity_id) return null;
  const plot = { col: selected.innerCol, row: selected.innerRow };
  if (plot.col === BUILDINGS_CENTER[0] && plot.row === BUILDINGS_CENTER[1]) return null;
  const building = setup.store.get("Building", {
    game_id: realm.game_id,
    structure_id: realm.entity_id,
    inner_col: plot.col,
    inner_row: plot.row,
  });
  return building && Number(building.category) !== 0 ? { building, plot } : null;
};

/** The upgrade sheet on a building: its tier now and next, what each gives, and the next tier's labor. */
export const BuildingUpgrade = ({
  realm,
  selected,
  onClose,
}: {
  realm: NativeRows["Structure"];
  selected: { building: NativeRows["Building"]; plot: HexPosition };
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  const revision = useNativeRevision(UPGRADE_MODELS);
  const plan = useMemo(
    () => readBuildingUpgradePlan(setup.store, realm, selected, tick),
    [realm, revision, selected, setup.store, tick],
  );
  if (!plan) return null;
  const upgrade = async () => {
    try {
      await setup.systemCalls.upgrade_building({
        signer: account.account as unknown as Account,
        structureId: realm.entity_id,
        coord: { alt: false, x: selected.plot.col, y: selected.plot.row },
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The building could not be upgraded."));
    }
  };
  return <UpgradeSheet plan={plan} upgrade={upgrade} onClose={onClose} />;
};

/**
 * A building's upgrade as its sheet draws it, from its Building.tier, the realm's researched tier and the tier rules:
 * the next tier only once researched, its price the rule's labor. Unknown while the realm's research is.
 */
export const readBuildingUpgradePlan = (
  store: NativeFactStore,
  realm: NativeRows["Structure"],
  { building, plot }: { building: NativeRows["Building"]; plot: HexPosition },
  tick: number,
): UpgradePlan | undefined => {
  const category = Number(building.category) as BuildingType;
  const researched = researchedBuildingTier(store, realm.game_id, realm.entity_id, category);
  if (researched === undefined) return undefined;
  const tier = Number(building.tier) as 1 | 2 | 3;
  const multiplier = isRealmMarkedPlot(store, realm, plot) ? 2 : 1;
  const step = (at: 1 | 2 | 3): UpgradeStep => ({
    art: BUILDING_IMAGES_PATH[category as keyof typeof BUILDING_IMAGES_PATH],
    tier: at,
    gain: effectGain(readBuildingEffect(store, realm, category, at, multiplier)),
  });
  const next = tier < researched ? ((tier + 1) as 2 | 3) : null;
  const labor = next
    ? Number(store.require("BuildingTierRule", { game_id: realm.game_id, category, tier: next }).labor_upgrade_cost) /
      RESOURCE_PRECISION
    : 0;
  const held = knownBalance(getBalance(realm.entity_id, ResourcesIds.Labor, tick, store).balance);
  return {
    name: FRONTIER_BUILDING_NAMES[category] ?? "",
    doubled: multiplier === 2,
    population: store.require("BuildingRule", { game_id: realm.game_id, category }).population_cost,
    now: step(tier),
    next: next ? step(next) : null,
    price: next ? [{ resource: ResourcesIds.Labor, amount: labor }] : [],
    affordable: next !== null && held !== undefined && held >= labor,
  };
};
