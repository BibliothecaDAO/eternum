import type { ArmyReach } from "@bibliothecadao/eternum";
import type { ContractAddress, ID } from "@bibliothecadao/types";

interface SelectedArmy {
  /** What bounds the army's orders now: its whole stamina and the steps its stamina and food pay for. */
  reach(entityId: ID): ArmyReach;
  /** Plans the army's orders from where the store has it and shows them. */
  offerOrders(entityId: ID, playerAddress: ContractAddress): void;
}

const isSameReach = (left: ArmyReach, right: ArmyReach): boolean =>
  left.stamina === right.stamina && left.travelSteps === right.travelSteps && left.canExplore === right.canExplore;

/**
 * Offers the selected army its orders, and again only when something that decides them moves. A selection, an order's
 * outcome or a map change offers them at once. A confirmed head only moves chain time, so it offers them only when the
 * army's stamina or food now pays for different orders.
 */
export class SelectedArmyOrders {
  private offered: { entityId: ID; reach: ArmyReach } | null = null;

  constructor(private readonly army: SelectedArmy) {}

  offer(entityId: ID, playerAddress: ContractAddress): void {
    this.offerAt(entityId, playerAddress, this.army.reach(entityId));
  }

  followConfirmedHead(entityId: ID, playerAddress: ContractAddress): void {
    const reach = this.army.reach(entityId);
    if (this.offered?.entityId === entityId && isSameReach(this.offered.reach, reach)) return;
    this.offerAt(entityId, playerAddress, reach);
  }

  private offerAt(entityId: ID, playerAddress: ContractAddress, reach: ArmyReach): void {
    this.offered = { entityId, reach };
    this.army.offerOrders(entityId, playerAddress);
  }
}
