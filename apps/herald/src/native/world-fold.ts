import type { CheckpointCodec } from "../checkpoint-store";
import { hash } from "starknet";
import { normalizeFelt } from "../model-registry";
import type { ModelRegistry } from "../model-registry";
import type { DecodedWorldEvent, FoldChange, FoldCheckpoint } from "../types";
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

  public override finalizedGameIds(): readonly string[] {
    return this.modelRows("GameRegistry")
      .filter(({ value }) => value.settled === true)
      .map(({ value }) => BigInt(value.game_id as string).toString());
  }

  protected override derivedModels(): readonly string[] {
    return [];
  }

  protected override applyEventRows(event: Extract<DecodedWorldEvent, { kind: "event" }>): FoldChange[] {
    if (event.model.name !== "ExecutionRecorded") return [];
    const { game_id, actor, nonce, nonce_consumed, order, status, reason } = event.value;
    const game = BigInt(String(game_id));
    const account = BigInt(String(actor));
    const submitted = BigInt(String(nonce));
    const result = BigInt(String(status));
    const code = BigInt(String(reason));
    if (BigInt(String(order)) === 0n || !((result === 1n && code === 0n) || (result === 2n && code !== 0n)))
      throw new Error("Invalid native execution outcome");
    if (!nonce_consumed) return [];
    if (
      game === 0n ||
      game >= 1n << 32n ||
      account === 0n ||
      account >= (1n << 251n) - 256n ||
      submitted === (1n << 64n) - 1n
    )
      throw new Error("Invalid consumed native nonce");
    const codec = this.registry.persistent.find((codec) => codec.definition.name === "ActionNonce");
    if (!codec) throw new Error("Missing native nonce schema");
    const change = this.apply({
      kind: "set",
      model: codec.definition,
      entityId: normalizeFelt(hash.computePoseidonHashOnElements([game, account])),
      position: event.position,
      key: { game_id: game, actor: account },
      value: { next_nonce: submitted + 1n },
    });
    return change ? [change] : [];
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
