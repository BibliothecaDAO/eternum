import {
  ActionPaths,
  ActionType,
  buildArmyPathIndexes,
  configManager,
  getBlockTimestamp,
  getExplorerOwner,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { WorldSpatialProjection } from "@bibliothecadao/eternum/game-sync";

import { accountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { activeMapLayer } from "@/three/map-layer";
import { offerSelectedArmyOrdersAtOutcome, sendSelectedArmyTravel } from "@/three/scenes/worldmap-army-order-selection";
import { ORDER_REQUEST_EVENT, pinsOrder, readOrderRequest } from "@/three/scenes/worldmap-order-request";
import { resolveWorldmapHexClickPlan } from "@/three/scenes/worldmap-selection-routing";
import { worldHexToWorld } from "@/three/world-origin";
import { toast } from "@/ui/features/event-feed/notify";
import { canIssueOrders, refusedBeforePlay } from "@/utils/can-issue-orders";

import type { Hex } from "./land-from-facts";
import { contractHexOf } from "./map-facts";
import { orderStops } from "./order-stops";

const ORDER_NOT_SENT = "The order was not sent.";

/** The key the rules file a hex's offered path under: the hex as contracts count it. */
function pathKeyOf(hex: Hex): string {
  const contract = contractHexOf(hex);
  return `${contract.col},${contract.row}`;
}

/**
 * What a tap on the map picks, by the same rules as today's map: the viewer's own army or structure on the hex, else
 * the hex. A picked army is offered its orders by the game's own rules. A tap on a hex it can move to or explore pins
 * that order and shows its path; the same hex tapped again, or the HUD's verb for it, sends the order. The other
 * orders the rules offer (an attack, a site, a chest, a spire, a new army) are not sent from this map yet.
 */
export class MapSelection {
  /** The order pinned: the offered path's hexes, normalized, from the army to its target. */
  private pinned: Hex[] = [];
  private readonly stopOffering: () => void;

  constructor(
    private readonly projection: WorldSpatialProjection,
    private readonly store: NativeFactStore,
    private readonly show: (stops: Float32Array) => void,
  ) {
    window.addEventListener(ORDER_REQUEST_EVENT, this.sendRequested);
    // At an order's outcome the army still picked is offered its orders from where it now stands.
    this.stopOffering = offerSelectedArmyOrdersAtOutcome((explorerId) => this.offerOrders(Number(explorerId)));
  }

  tapAt(hex: Hex): void {
    if (this.isPinnedTo(hex)) return this.sendOrderTo(hex);
    if (this.pinOrderTo(hex)) return;
    if (this.openTargetCardAt(hex)) return;
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
    window.removeEventListener(ORDER_REQUEST_EVENT, this.sendRequested);
    this.stopOffering();
    this.unpinOrder();
  }

  /** The HUD's verb asks for the order at a tile to be sent. */
  private readonly sendRequested = (event: Event): void => {
    const tile = readOrderRequest(event);
    if (tile) this.sendOrderTo(tile);
  };

  private isPinnedTo(hex: Hex): boolean {
    const target = this.pinned.at(-1);
    return target !== undefined && target.col === hex.col && target.row === hex.row;
  }

  /**
   * Sends the picked army's move or explore to a hex, by the game's own gates: only a player, only once play has
   * opened, only an order the rules still offer there. A refusal is told as any failed action is.
   */
  private sendOrderTo(hex: Hex): void {
    const { selectedEntityId, actionPaths } = useUIStore.getState().entityActions;
    const path = actionPaths.get(pathKeyOf(hex));
    if (selectedEntityId == null || !path || !pinsOrder(path) || !canIssueOrders() || refusedBeforePlay()) return;
    const explorerId = Number(selectedEntityId);
    const order = ActionPaths.getActionType(path) === ActionType.Explore ? "explore" : "move";
    this.pinned = [];
    this.showOrder();
    sendSelectedArmyTravel(
      explorerId,
      { order, to: hex },
      () => requireActiveGameClient().actions.moveArmy({ explorerId, path }),
      { applied: () => {}, refused: (error) => toast.failed(error, ORDER_NOT_SENT) },
    );
  }

  /** Pins the picked army's order to a hex it is offered; false when the hex is not one. */
  private pinOrderTo(hex: Hex): boolean {
    const ui = useUIStore.getState();
    const path = ui.entityActions.actionPaths.get(pathKeyOf(hex));
    if (!pinsOrder(path)) return false;
    const centre = configManager.getMapCenter();
    this.pinned = path!.map((step) => ({ col: step.hex.col - centre, row: step.hex.row - centre }));
    // The HUD reads the pinned tile as the map's scene names it: its bar shows the order and carries its verb.
    ui.updateEntityActionHoveredHex(hex);
    this.showOrder();
    return true;
  }

  /**
   * Opens the card of a hex where the rules offer the picked army something other than a walk (an attack, a site,
   * a chest, a spire, troops to another army), with the army kept as its actor: the HUD's card there carries the
   * forecast and the verb. False when the hex is offered nothing.
   */
  private openTargetCardAt(hex: Hex): boolean {
    const ui = useUIStore.getState();
    const { selectedEntityId, actionPaths } = ui.entityActions;
    if (selectedEntityId == null || !actionPaths.has(pathKeyOf(hex))) return false;
    this.unpinOrder();
    ui.selectOnMap({ kind: "army", entityId: selectedEntityId, tile: contractHexOf(hex) });
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
