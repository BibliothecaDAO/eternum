import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

export const deepSites = [
  { id: nativeRuleConstants.DEEP_FOUNDATION, name: "Foundation", position: "foundation" },
  { id: nativeRuleConstants.DEEP_QUARRY, name: "Quarry", position: "quarry" },
  { id: nativeRuleConstants.DEEP_ALTAR, name: "Altar", position: "altar" },
] as const;
