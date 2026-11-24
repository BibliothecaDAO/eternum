import { configManager } from "@bibliothecadao/eternum";
import { FRAGMENT_SPEND_COMMANDS } from "@bibliothecadao/types";

type FragmentSpend = (typeof FRAGMENT_SPEND_COMMANDS)[number];

interface FragmentSpendsWindow {
  __eternumFragmentSpends?: () => FragmentSpend[];
}

export const installFragmentSpendsReader = (): void => {
  if (typeof window === "undefined") return;
  (window as typeof window & FragmentSpendsWindow).__eternumFragmentSpends = readFragmentSpends;
};

const readFragmentSpends = (): FragmentSpend[] =>
  FRAGMENT_SPEND_COMMANDS.filter((command) => configManager.isCommandEnabled(command));
