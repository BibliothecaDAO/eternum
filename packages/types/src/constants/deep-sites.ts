import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";

export const deepSites = [
  { id: nativeRuleConstants.DEEP_FOUNDATION, name: "Hyperstructure archive", key: "foundation" },
  { id: nativeRuleConstants.DEEP_CORE, name: "Essence core", key: "core" },
  { id: nativeRuleConstants.DEEP_MINE, name: "Ethereal mine", key: "mine" },
  { id: nativeRuleConstants.DEEP_ALTAR, name: "Bane altar", key: "altar" },
] as const;
