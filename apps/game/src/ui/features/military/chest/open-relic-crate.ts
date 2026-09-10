import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import type { SetupResult } from "@bibliothecadao/dojo";
import type { ID } from "@bibliothecadao/types";
import type { Account, AccountInterface } from "starknet";

export interface OpenRelicCrateRequest {
  systemCalls: SetupResult["systemCalls"];
  account: Account | AccountInterface;
  explorerId: ID;
  hex: { col: number; row: number };
}

/** The one way to open a crate, from the context menu or the tile panel: the reveal comes back as an event. */
export async function openRelicCrate({ systemCalls, account, explorerId, hex }: OpenRelicCrateRequest): Promise<void> {
  try {
    await systemCalls.open_chest({
      signer: account,
      explorer_id: explorerId,
      chest_coord: { alt: DEFAULT_COORD_ALT, x: hex.col, y: hex.row },
    });
  } catch (error) {
    toast.error(`Could not open the crate: ${extractReadableErrorMessage(error, "transaction rejected")}`, {
      location: { x: hex.col, y: hex.row },
    });
  }
}
