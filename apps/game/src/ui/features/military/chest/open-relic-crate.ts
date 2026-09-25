import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { DEFAULT_COORD_ALT } from "@bibliothecadao/eternum";
import type { GameClientSetup as SetupResult } from "@bibliothecadao/eternum/game-client";
import type { ID } from "@bibliothecadao/types";
import type { Account, AccountInterface } from "starknet";

export interface OpenRelicCrateRequest {
  systemCalls: SetupResult["systemCalls"];
  account: Account | AccountInterface;
  explorerId: ID;
  hex: { col: number; row: number };
}

/** The one chest command, sent by the world map's opener: the result comes back as a story. False when refused. */
export async function openRelicCrate({
  systemCalls,
  account,
  explorerId,
  hex,
}: OpenRelicCrateRequest): Promise<boolean> {
  try {
    await systemCalls.open_chest({
      signer: account,
      explorer_id: explorerId,
      chest_coord: { alt: DEFAULT_COORD_ALT, x: hex.col, y: hex.row },
    });
    return true;
  } catch (error) {
    toast.error(`Could not open the chest: ${extractReadableErrorMessage(error, "transaction rejected")}`, {
      location: { x: hex.col, y: hex.row },
    });
    return false;
  }
}
