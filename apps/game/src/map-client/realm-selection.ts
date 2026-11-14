import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { canIssueOrders } from "@/utils/can-issue-orders";

import type { Hex } from "./land-from-facts";
import type { RealmLand } from "./realm-facts";

const at = (hex: Hex) => (other: Hex) => other.col === hex.col && other.row === hex.row;

/**
 * A tap on a realm's hex, told to the HUD as today's realm view tells it: a building or the keep is picked and its
 * panel opens; an open plot is picked by whoever may give orders; anything else puts the pick away.
 */
export function tapRealmHex(realm: RealmLand, hex: Hex): void {
  const ui = useUIStore.getState();
  const plot = realm.cells.find(at(hex))?.plot === true;
  const built = realm.buildings.some(at(hex));
  if (!plot || (!built && !canIssueOrders())) return ui.setSelectedBuildingHex(null);
  ui.setSelectedBuildingHex({ structureId: realm.realmId, innerCol: hex.col, innerRow: hex.row });
  ui.setLeftNavigationView(LeftView.EntityView);
}
