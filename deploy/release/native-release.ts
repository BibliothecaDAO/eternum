import { nativeIdentifiers } from "../../contracts/l3/world-native/schema/client.gen";

export const NATIVE_RELEASES = {
  frontier: { family: nativeIdentifiers.family.FRONTIER, release: 14, since: 14 },
} as const;
