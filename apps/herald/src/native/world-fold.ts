import type { CheckpointCodec } from "../checkpoint-store";
import type { ModelRegistry } from "../model-registry";
import type { FoldCheckpoint } from "../types";
import { checkpointModelMismatch, WorldFold, type StoredModelRow } from "../world-fold";

const checkpointMismatch: CheckpointCodec["mismatch"] = (registry, checkpoint) => {
  if (registry.nativeSchemaIdentity !== checkpoint.native_schema_identity) return "native schema identity differs";
  return checkpointModelMismatch(registry, checkpoint);
};

export class NativeWorldFold extends WorldFold {
  public static override restore(registry: ModelRegistry, checkpoint: FoldCheckpoint): NativeWorldFold {
    const mismatch = checkpointMismatch(registry, checkpoint);
    if (mismatch) throw new Error(`Checkpoint model mismatch; ${mismatch}`);
    return super.restore(registry, checkpoint) as NativeWorldFold;
  }

  public override checkpoint(): FoldCheckpoint {
    return { ...super.checkpoint(), native_schema_identity: this.registry.nativeSchemaIdentity };
  }

  public override overlay(): NativeWorldFold {
    return new NativeWorldFold(this.registry, this);
  }

  public override modelRows(model: string) {
    return this.registry.nativeAbsentCollections?.includes(model) ? [] : super.modelRows(model);
  }

  protected override previousBattleParticipant(storageKey: string): StoredModelRow | undefined {
    return this.storedRow("LastBattle", storageKey);
  }
}

export const nativeCheckpointCodec: CheckpointCodec = {
  mismatch: checkpointMismatch,
  restore: (registry, checkpoint) => NativeWorldFold.restore(registry, checkpoint),
};
