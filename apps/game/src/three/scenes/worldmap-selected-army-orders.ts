import type { ArmyReach } from "@bibliothecadao/eternum";
import type { ContractAddress, ID } from "@bibliothecadao/types";

interface SelectedArmy {
  /** What bounds the army's orders now: its whole stamina and the steps its stamina and food pay for. */
  reach(entityId: ID): ArmyReach;
  /** Whether the army's last order is in flight: its outcome, not yet known, offers its orders again. */
  isBusy(entityId: ID): boolean;
  /** Plans the army's orders from where the store has it and shows them. */
  offerOrders(entityId: ID, playerAddress: ContractAddress): void;
}

const isSameReach = (left: ArmyReach, right: ArmyReach): boolean =>
  left.stamina === right.stamina && left.travelSteps === right.travelSteps && left.canExplore === right.canExplore;

/**
 * Offers the selected army its orders, and again only when something that decides them moves. A selection or an
 * order's outcome offers them at once. A map change offers them at once too, unless the army's order is in flight: an
 * action's facts land before its outcome, and the outcome offers them, so its orders change once, in place. A
 * confirmed head only moves chain time, so it offers them only when the army's stamina or food now pays for different
 * orders.
 */
export class SelectedArmyOrders {
  private offered: { entityId: ID; reach: ArmyReach } | null = null;

  constructor(private readonly army: SelectedArmy) {}

  offer(entityId: ID, playerAddress: ContractAddress): void {
    this.offerAt(entityId, playerAddress, this.army.reach(entityId));
  }

  followMapChange(entityId: ID, playerAddress: ContractAddress): void {
    if (this.army.isBusy(entityId)) return;
    this.offer(entityId, playerAddress);
  }

  followConfirmedHead(entityId: ID, playerAddress: ContractAddress): void {
    if (this.army.isBusy(entityId)) return;
    const reach = this.army.reach(entityId);
    if (this.offered?.entityId === entityId && isSameReach(this.offered.reach, reach)) return;
    this.offerAt(entityId, playerAddress, reach);
  }

  private offerAt(entityId: ID, playerAddress: ContractAddress, reach: ArmyReach): void {
    this.offered = { entityId, reach };
    this.army.offerOrders(entityId, playerAddress);
  }
}
