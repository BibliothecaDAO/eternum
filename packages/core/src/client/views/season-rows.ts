import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeFactResult, NativeFactStore, ReadKeys } from "../native-fact-store";

type OptionalSeasonModel = "BaneRules" | "WorldBane" | "FirstTeamBane" | "TeamBane" | "RaceRules" | "TriumphDay";

/** Optional season state is absent only after its complete snapshot proves that absence. */
export function readOptionalSeasonRow<M extends OptionalSeasonModel>(
  store: NativeFactStore,
  model: M,
  keys: ReadKeys<M>,
): NativeFactResult<{ row: NativeRows[M] | undefined }> {
  const row = store.get(model, keys);
  if (row) return { known: { row } };
  const absence = store.absenceKnown(model, keys);
  return absence.known ? { known: { row: undefined } } : { unknown: absence.unknown };
}
