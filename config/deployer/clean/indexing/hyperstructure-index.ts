import type { HeraldGameSnapshot } from "@bibliothecadao/eternum/game-sync";

export function planHyperstructureIndexBackfill(snapshot: HeraldGameSnapshot): number[] {
  const globals = rows(snapshot, "HyperstructureGlobals");
  const completed = rows(snapshot, "Hyperstructure").filter(
    (row) => row.initialized === true && row.completed === true,
  );
  const count =
    globals.length === 0 && completed.length === 0 ? 0 : integer(globals[0]?.completed_count, "completed_count");
  if (globals.length > 1 || completed.length !== count)
    throw new Error("Completed hyperstructures do not match the game counter");
  const remaining = new Set(completed.map((row) => integer(row.hyperstructure_id, "hyperstructure_id")));
  if (remaining.size !== count || remaining.has(0))
    throw new Error("Completed hyperstructures contain invalid or duplicate IDs");
  const ids = new Array<number>(count);
  for (const row of rows(snapshot, "CompletedHyperstructure")) {
    const index = integer(row.index, "index");
    const id = integer(row.hyperstructure_id, "hyperstructure_id");
    if (index >= count || ids[index] !== undefined || !remaining.delete(id))
      throw new Error("Existing completion index is inconsistent");
    ids[index] = id;
  }
  const missing = [...remaining].sort((a, b) => a - b);
  let next = 0;
  for (let index = 0; index < count; index++) {
    ids[index] ??= missing[next++];
  }
  return ids;
}

function rows(snapshot: HeraldGameSnapshot, name: string): Record<string, unknown>[] {
  const matches = snapshot.models.filter((model) => model.model === name || model.model.endsWith(`-${name}`));
  if (matches.length !== 1) throw new Error(`Expected one ${name} model in snapshot`);
  const values = matches[0]?.rows.map((row) => row.value) ?? [];
  for (const row of values) {
    if (integer(row.game_id, "game_id") !== integer(snapshot.game_id, "snapshot.game_id"))
      throw new Error("Snapshot contains a different game");
  }
  return values;
}

function integer(value: unknown, name: string): number {
  if (typeof value !== "string" && typeof value !== "number") throw new Error(`Missing or invalid ${name}`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0 || result > 0xffff_ffff) throw new Error(`Invalid ${name}`);
  return result;
}
