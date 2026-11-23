import { nativeRuleConstants } from "../../../../contracts/l3/world-native/schema/balance.gen";
import { FRAGMENT_SPEND_COMMANDS } from "@bibliothecadao/types";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";

/** Whether a game's rules turn a mode rule on: the one reading of the rules mask on the client. */
export const isModeRuleEnabled = (
  rules: { readonly mode_rules: number },
  rule: keyof typeof nativeRuleConstants,
): boolean => (rules.mode_rules & nativeRuleConstants[rule]) !== 0;

export const isCommandEnabled = (
  rules: { readonly command_mask: bigint },
  command: keyof typeof nativeCommandBits,
): boolean => (BigInt(rules.command_mask) & BigInt(nativeCommandBits[command])) !== 0n;

export const spendsFragments = (rules: { readonly command_mask: bigint }): boolean =>
  FRAGMENT_SPEND_COMMANDS.some((command) => isCommandEnabled(rules, command));
