import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
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

/**
 * The one chest command, sent by the world map's opener as the army's order (one at a time, held until it settles, like
 * every army order): the result comes back as a story. False when refused, or when the army already has an order out.
 */
export async function openRelicCrate({
  systemCalls,
  account,
  explorerId,
  hex,
}: OpenRelicCrateRequest): Promise<boolean> {
  try {
    const opened = await sendOnce("army", explorerId, { order: "use" }, () =>
      systemCalls.open_chest({
        signer: account,
        explorer_id: explorerId,
        chest_coord: { alt: DEFAULT_COORD_ALT, x: hex.col, y: hex.row },
      }),
    );
    return opened !== null;
  } catch (error) {
    toast.failed(error, "Could not open the chest.", {
      location: { x: hex.col, y: hex.row },
    });
    return false;
  }
}
