import { sendOnce } from "@/hooks/store/use-actions-in-flight";
import { safeInteger, type GameClientSetup, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Account, AccountInterface } from "starknet";

/** A realm's research row, as the actions in flight name it. */
export const researchKey = (realm: NativeRows["Structure"], row: number): string =>
  `${safeInteger(realm.entity_id)}:${row}`;

/**
 * Researches a row for the realm, one research of a row at a time. `onSent` runs as the command leaves, which is
 * when its sheet closes; the row then carries the wait until the research's own outcome. Rejects with the reason
 * when it was refused, could not be sent or got no answer.
 */
export const sendResearch = (
  systemCalls: GameClientSetup["systemCalls"],
  signer: AccountInterface,
  realm: NativeRows["Structure"],
  { row, choice }: { row: number; choice: number },
  onSent: () => void,
): Promise<string | null> =>
  sendOnce("research", researchKey(realm, row), true, async () => {
    const sent = await systemCalls.research({
      signer: signer as unknown as Account,
      structureId: realm.entity_id,
      row,
      choice,
    });
    onSent();
    return sent;
  });
