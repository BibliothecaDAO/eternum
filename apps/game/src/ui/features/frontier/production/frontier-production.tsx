import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { knownBalance } from "@/ui/utils/utils";
import { getBalance, ResourceManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

import { useGoToFrontierPlace } from "../frontier-home";
import { realmPerHour } from "../hud/army-order";
import { type ProductionLine, ProductionSheet, type SpentAt } from "./production-sheet";

const PRODUCTION_MODELS = ["ResourceBalance", "ResourceProduction", "Building"] as const;

/** The three stores Production shows, the resource each holds and where it is spent when full. */
const STORES: { icon: ProductionLine["icon"]; resource: ResourcesIds; spentAt: SpentAt }[] = [
  { icon: "Wh", resource: ResourcesIds.Wheat, spentAt: "deploy" },
  { icon: "La", resource: ResourcesIds.Labor, spentAt: "realm" },
  // One troop type: the barracks train the realm's troops.
  { icon: "Tr", resource: ResourcesIds.Knight, spentAt: "deploy" },
];

/**
 * Production over the game's facts: each store's rate an hour, what it holds and whether a building makes it. Store
 * limits, Full in and the side marks arrive with the contracts' store limits and building tiers.
 */
export const FrontierProduction = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(PRODUCTION_MODELS);
  const goToPlace = useGoToFrontierPlace(realm);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const manager = new ResourceManager(setup.store, realm.entity_id);
  const lines = STORES.map(({ icon, resource, spentAt }): ProductionLine => {
    const balance = knownBalance(getBalance(realm.entity_id, resource, tick, setup.store).balance);
    const buildings = manager.current(resource)?.production?.building_count;
    return {
      icon,
      perHour: realmPerHour(setup.store, realm.entity_id, resource, tick),
      held: balance === undefined ? undefined : Math.floor(balance),
      limit: undefined,
      tone: "calm",
      fullIn: undefined,
      noBuilding: buildings === 0,
      spentAt,
    };
  });
  return (
    <ProductionSheet
      lines={lines}
      onSpend={(at) => {
        onClose();
        if (at === "realm") goToPlace(false);
        else setLeftNavigationView(LeftView.MilitaryView);
      }}
      onBuild={() => {
        onClose();
        goToPlace(false);
      }}
      onClose={onClose}
    />
  );
};
