import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/client.gen";

/** Whether a game's rules turn a mode rule on: the one reading of the rules mask on the client. */
export const isModeRuleEnabled = (
  rules: { readonly mode_rules: number },
  rule: keyof typeof nativeRuleConstants,
): boolean => (rules.mode_rules & nativeRuleConstants[rule]) !== 0;
