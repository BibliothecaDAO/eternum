import { nativeIdentifiers } from "../../../../contracts/l3/world-native/schema/client.gen";
import type { NativeReleases } from "../sync/herald-http-types";

export const releaseLine = (
  schema: string,
  releaseIds: readonly number[],
  family: number = nativeIdentifiers.family.FRONTIER,
): NativeReleases =>
  Object.fromEntries(
    releaseIds.map((id, index) => [String(id), { schema, family, previous: releaseIds[index - 1] ?? 0 }]),
  );
