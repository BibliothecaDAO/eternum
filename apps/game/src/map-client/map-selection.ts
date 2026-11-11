import { buildArmyPathIndexes, configManager, getBlockTimestamp, getExplorerOwner } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

import { accountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { activeMapLayer } from "@/three/map-layer";
import { resolveWorldmapHexClickPlan } from "@/three/scenes/worldmap-selection-routing";
import { worldHexToWorld } from "@/three/world-origin";

import type { Hex } from "./land-from-facts";
import { contractHexOf } from "./map-facts";
import { orderStops } from "./order-stops";

/**
 * What a tap on the map picks, by the same rules as today's map: the viewer's own army or structure on the hex, else
 * the hex. A picked army is offered its orders by the game's own rules; a tap on a hex it is offered pins that order
 * and shows its path. Orders are not sent from this map yet.
 */
export class MapSelection {
  /** The order pinned: the offered path's hexes, normalized, from the army to its target. */
  private pinned: Hex[] = [];

  constructor(
    private readonly projection: WorldSpatialProjection,
    private readonly store: NativeFactStore,
    private readonly show: (stops: Float32Array) => void,
  ) {}

  tapAt(hex: Hex): void {
    if (this.pinOrderTo(hex)) return;
    const contract = contractHexOf(hex);
    const army = this.projection.getArmiesAtHex({ alt: activeMapLayer(), ...contract })[0];
    const structure = this.projection.getStandingStructureAtHex({ alt: activeMapLayer(), ...contract });
    const plan = resolveWorldmapHexClickPlan({
      hexCoords: hex,
      accountAddress: accountAddress(),
      army: army && { id: army.entityId, owner: this.armyOwner(army.entityId) },
      structure: structure && { id: structure.entityId, owner: this.structureOwner(structure.entityId) },
    });
    if (plan.kind === "ignore") return;
    this.unpinOrder();
    const ui = useUIStore.getState();
    if (plan.selection.type === "army") {
      ui.selectOnMap({ kind: "army", entityId: plan.selection.entityId, tile: "own" });
      this.offerOrders(plan.selection.entityId);
    } else if (plan.selection.type === "structure") {
      ui.selectOnMap({ kind: "structure", entityId: plan.selection.entityId });
    } else {
      ui.selectOnMap({ kind: "hex", hex: contract });
    }
  }

  /** Shows the pinned order again, after the renderer took a new land. */
  showOrder(): void {
    this.show(orderStops(this.pinned.map((hex) => worldHexToWorld(hex.col, hex.row))));
  }

  dispose(): void {
    this.unpinOrder();
  }

  /** Pins the picked army's order to a hex it is offered; false when the hex is not one. */
  private pinOrderTo(hex: Hex): boolean {
    const ui = useUIStore.getState();
    const contract = contractHexOf(hex);
    const path = ui.entityActions.actionPaths.get(`${contract.col},${contract.row}`);
    if (!path || path.length < 2) return false;
    const centre = configManager.getMapCenter();
    this.pinned = path.map((step) => ({ col: step.hex.col - centre, row: step.hex.row - centre }));
    ui.updateEntityActionHoveredHex(contract);
    this.showOrder();
    return true;
  }

  private unpinOrder(): void {
    if (this.pinned.length === 0) return;
    this.pinned = [];
    useUIStore.getState().updateEntityActionHoveredHex(null);
    this.showOrder();
  }

  /** The orders the game's rules offer the picked army, for the HUD and for the next tap. */
  private offerOrders(explorerId: number): void {
    const viewer = accountAddress();
    if (viewer === null) return;
    const client = requireActiveGameClient();
    const offered = client.actions.armyPaths({
      explorerId,
      ...buildArmyPathIndexes(client, activeMapLayer()),
      currentDefaultTick: getBlockTimestamp().currentDefaultTick,
      playerAddress: viewer,
    });
    useUIStore.getState().updateEntityActionActionPaths(offered.getPaths());
  }

  private armyOwner(explorerId: number): bigint | undefined {
    const explorer = this.store.get("ExplorerTroops", {
      game_id: configManager.getActiveGameId(),
      explorer_id: explorerId,
    });
    return explorer ? getExplorerOwner(this.store, explorer) : undefined;
  }

  private structureOwner(structureId: number | null): bigint | undefined {
    if (structureId === null) return undefined;
    return this.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: structureId })?.owner;
  }
}
