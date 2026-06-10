import type { Signer } from "../config";

export class CombatTransactions {
  constructor(private provider: any) {}

  async attackExplorer(
    signer: Signer,
    props: {
      aggressorId: number;
      defenderId: number;
      stealResources: { resourceId: number; amount: number }[];
    },
  ) {
    return this.provider.attack_explorer_vs_explorer({
      signer,
      aggressor_id: props.aggressorId,
      defender_id: props.defenderId,
      steal_resources: props.stealResources.map((r) => ({
        resourceId: r.resourceId,
        amount: r.amount,
      })),
    });
  }

  async attackGuard(
    signer: Signer,
    props: {
      explorerId: number;
      structureId: number;
    },
  ) {
    return this.provider.attack_explorer_vs_guard({
      signer,
      explorer_id: props.explorerId,
      structure_id: props.structureId,
    });
  }

  async guardAttackExplorer(
    signer: Signer,
    props: {
      structureId: number;
      structureGuardSlot: number;
      explorerId: number;
    },
  ) {
    return this.provider.attack_guard_vs_explorer({
      signer,
      structure_id: props.structureId,
      structure_guard_slot: props.structureGuardSlot,
      explorer_id: props.explorerId,
    });
  }

  async raid(
    signer: Signer,
    props: {
      explorerId: number;
      structureId: number;
      structureDirection: number;
      stealResources: { resourceId: number; amount: number }[];
    },
  ) {
    return this.provider.raid_explorer_vs_guard({
      signer,
      explorer_id: props.explorerId,
      structure_id: props.structureId,
      structure_direction: props.structureDirection,
      steal_resources: props.stealResources.map((r) => ({
        resourceId: r.resourceId,
        amount: r.amount,
      })),
    });
  }
}
