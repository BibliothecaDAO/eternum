import { useGame } from "@/hooks/context/game-context";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { type ExpeditionRules, realmLearned, ResourceManager } from "@bibliothecadao/eternum";
import { nativeResearchConstants as research, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { sidesTaken } from "../research/sides-taken";
import { type ProductionLine, ProductionSheet, type SpentAt } from "./production-sheet";

/** The three stores Production shows, the store each reads, its research row and where it is spent when full. */
const STORES: {
  icon: ProductionLine["icon"];
  store: "wheat" | "labor" | "troops";
  resource: ResourcesIds;
  row: number;
  spentAt: SpentAt;
}[] = [
  { icon: "Wh", store: "wheat", resource: ResourcesIds.Wheat, row: research.ROW_FARM, spentAt: "deploy" },
  { icon: "La", store: "labor", resource: ResourcesIds.Labor, row: research.ROW_WORKSHOP, spentAt: "realm" },
  // One troop type: the barracks train the realm's troops.
  { icon: "Tr", store: "troops", resource: ResourcesIds.Knight, row: research.ROW_BARRACKS, spentAt: "deploy" },
];

/**
 * Production over the game's facts: each store's rate an hour with the sides its row has taken, what it holds against
 * its limit, when it is full, and whether a building makes it.
 */
export const FrontierProduction = ({
  rules,
  realm,
  onClose,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"];
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const stores = useRealmStores(realm, rules);
  const goToPlace = useGoToFrontierPlace(realm);
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const manager = new ResourceManager(setup.store, realm.entity_id);
  const learned = realmLearned(setup.store, realm.game_id, realm.entity_id);
  const lines = STORES.map(({ icon, store, resource, row, spentAt }): ProductionLine => {
    const reading = stores?.[store];
    return {
      icon,
      perHour: reading?.perHour,
      sides: learned === undefined ? undefined : sidesTaken(learned, row),
      held: reading?.amount,
      limit: reading?.limit,
      tone: reading?.tone ?? "calm",
      fullIn: reading?.fullIn,
      noBuilding: manager.current(resource)?.production?.building_count === 0,
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
