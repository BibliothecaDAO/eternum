import type { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";

type NativeCommandName = keyof typeof nativeCommandBits;

/** The transfers an army's Help surface offers, each with the commands it may send. */
const HELP_TRANSFERS = {
  troops: ["ManageTroops"],
  relics: ["TransferExplorerResources", "TransferExplorerResourcesToStructure"],
} as const satisfies Record<string, readonly NativeCommandName[]>;

export type HelpTransfer = keyof typeof HELP_TRANSFERS;

/**
 * Which way a Help's troops go: between two armies, out of a structure to an army beside it, or from an army into a
 * structure.
 */
export type HelpBetween = "armies" | "from-structure" | "to-structure";

/**
 * The Help transfers a game allows between two of a player's own entities. Each needs a command the mask enables.
 * Troops going into a structure need guard slots to hold them. A structure sends troops out of its stock
 * (RecruitExplorer), so it needs none to reinforce an army beside it. Help is offered only where one transfer remains.
 */
export const enabledHelpTransfers = (
  isCommandEnabled: (command: NativeCommandName) => boolean,
  between: HelpBetween,
  hasGuardSlots: boolean,
): HelpTransfer[] =>
  (Object.keys(HELP_TRANSFERS) as HelpTransfer[]).filter(
    (transfer) =>
      HELP_TRANSFERS[transfer].some(isCommandEnabled) &&
      !(transfer === "troops" && between === "to-structure" && !hasGuardSlots),
  );
