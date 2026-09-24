import type { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";

type NativeCommandName = keyof typeof nativeCommandBits;

/** The transfers an army's Help surface offers, each with the commands it may send. */
const HELP_TRANSFERS = {
  troops: ["ManageTroops"],
  relics: ["TransferExplorerResources", "TransferExplorerResourcesToStructure", "TransferStructureResourcesToExplorer"],
} as const satisfies Record<string, readonly NativeCommandName[]>;

export type HelpTransfer = keyof typeof HELP_TRANSFERS;

/**
 * The Help transfers a game allows between two of a player's own entities. Each needs a command the mask enables, and
 * troops moving to or from a structure need guard slots to hold them. Help is offered only where one transfer remains.
 */
export const enabledHelpTransfers = (
  isCommandEnabled: (command: NativeCommandName) => boolean,
  withStructure: boolean,
  hasGuardSlots: boolean,
): HelpTransfer[] =>
  (Object.keys(HELP_TRANSFERS) as HelpTransfer[]).filter(
    (transfer) =>
      HELP_TRANSFERS[transfer].some(isCommandEnabled) && !(transfer === "troops" && withStructure && !hasGuardSlots),
  );
