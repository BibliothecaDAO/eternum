import type { Signer } from "../config";

export class TroopTransactions {
  constructor(private provider: any) {}

  async createExplorer(
    signer: Signer,
    props: {
      forStructureId: number;
      category: number;
      tier: number;
      amount: number;
      spawnDirection: number;
    },
  ) {
    return this.provider.explorer_create({
      signer,
      for_structure_id: props.forStructureId,
      category: props.category,
      tier: props.tier,
      amount: props.amount,
      spawn_direction: props.spawnDirection,
    });
  }

  async addToExplorer(
    signer: Signer,
    props: {
      toExplorerId: number;
      amount: number;
      homeDirection: number;
    },
  ) {
    return this.provider.explorer_add({
      signer,
      to_explorer_id: props.toExplorerId,
      amount: props.amount,
      home_direction: props.homeDirection,
    });
  }

  async deleteExplorer(
    signer: Signer,
    props: {
      explorerId: number;
    },
  ) {
    return this.provider.explorer_delete({
      signer,
      explorer_id: props.explorerId,
    });
  }

  async addGuard(
    signer: Signer,
    props: {
      forStructureId: number;
      slot: number;
      category: number;
      tier: number;
      amount: number;
    },
  ) {
    return this.provider.guard_add({
      signer,
      for_structure_id: props.forStructureId,
      slot: props.slot,
      category: props.category,
      tier: props.tier,
      amount: props.amount,
    });
  }

  async deleteGuard(
    signer: Signer,
    props: {
      forStructureId: number;
      slot: number;
    },
  ) {
    return this.provider.guard_delete({
      signer,
      for_structure_id: props.forStructureId,
      slot: props.slot,
    });
  }

  async move(
    signer: Signer,
    props: {
      explorerId: number;
      directions: number[];
      explore: boolean;
    },
  ) {
    return this.provider.explorer_move({
      signer,
      explorer_id: props.explorerId,
      directions: props.directions,
      explore: props.explore,
    });
  }

  async travel(
    signer: Signer,
    props: {
      explorerId: number;
      directions: number[];
    },
  ) {
    return this.provider.explorer_travel({
      signer,
      explorer_id: props.explorerId,
      directions: props.directions,
    });
  }

  async explore(
    signer: Signer,
    props: {
      explorerId: number;
      directions: number[];
    },
  ) {
    return this.provider.explorer_explore({
      signer,
      explorer_id: props.explorerId,
      directions: props.directions,
    });
  }

  async swapExplorerToExplorer(
    signer: Signer,
    props: {
      fromExplorerId: number;
      toExplorerId: number;
      toExplorerDirection: number;
      count: number;
    },
  ) {
    return this.provider.explorer_explorer_swap({
      signer,
      from_explorer_id: props.fromExplorerId,
      to_explorer_id: props.toExplorerId,
      to_explorer_direction: props.toExplorerDirection,
      count: props.count,
    });
  }

  async swapExplorerToGuard(
    signer: Signer,
    props: {
      fromExplorerId: number;
      toStructureId: number;
      toStructureDirection: number;
      toGuardSlot: number;
      count: number;
    },
  ) {
    return this.provider.explorer_guard_swap({
      signer,
      from_explorer_id: props.fromExplorerId,
      to_structure_id: props.toStructureId,
      to_structure_direction: props.toStructureDirection,
      to_guard_slot: props.toGuardSlot,
      count: props.count,
    });
  }

  async swapGuardToExplorer(
    signer: Signer,
    props: {
      fromStructureId: number;
      fromGuardSlot: number;
      toExplorerId: number;
      toExplorerDirection: number;
      count: number;
    },
  ) {
    return this.provider.guard_explorer_swap({
      signer,
      from_structure_id: props.fromStructureId,
      from_guard_slot: props.fromGuardSlot,
      to_explorer_id: props.toExplorerId,
      to_explorer_direction: props.toExplorerDirection,
      count: props.count,
    });
  }
}
