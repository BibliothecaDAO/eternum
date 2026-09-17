import type { CheckpointCodec } from "../checkpoint-store";
import type { ModelRegistry } from "../model-registry";
import type { FoldCheckpoint } from "../types";
import { checkpointModelMismatch, WorldFold } from "../world-fold";

const checkpointMismatch: CheckpointCodec["mismatch"] = (registry, checkpoint) => {
  if (registry.nativeSchemaIdentity !== checkpoint.native_schema_identity) return "native schema identity differs";
  return checkpointModelMismatch(registry, checkpoint, []);
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

  protected override derivedModels(): readonly string[] {
    return [];
  }

  protected override applyEventRows() {
    return [];
  }

  public override gameplayAccounts(gameId: string | number | bigint): ReadonlySet<string> {
    return new Set(
      this.modelRows("PlayerEntry")
        .filter(({ value }) => BigInt(value.game_id as string) === BigInt(gameId))
        .map(({ value }) => `0x${BigInt(value.player as string).toString(16)}`),
    );
  }
}

export const nativeCheckpointCodec: CheckpointCodec = {
  mismatch: checkpointMismatch,
  restore: (registry, checkpoint) => NativeWorldFold.restore(registry, checkpoint),
};
