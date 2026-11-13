import { identityClient } from "@/hooks/context/identity-session";
import { OPENING_MOMENTS, type OpeningMoment, type OpeningRecord } from "@realms-world/identity";

/**
 * The lab player's record of Frontier's opening interface, answered on the identity client as the server keeps it: a
 * save adds moments and sets Show everything when it names it. A seasoned account (every moment reached) by default,
 * so a lab page shows the whole HUD; a fresh one (`reached` empty) shows the HUD as a new player meets it. Returns the
 * restore.
 */
export const answerLabOpening = (owner: string, reached: readonly OpeningMoment[] = OPENING_MOMENTS): (() => void) => {
  const { getInterfaceOpening, saveInterfaceOpening } = identityClient;
  let record: OpeningRecord = { owner, reached: [...reached], showAll: false };
  identityClient.getInterfaceOpening = async () => record;
  identityClient.saveInterfaceOpening = async (change) => {
    record = {
      owner,
      reached: [...new Set([...record.reached, ...change.reach])],
      showAll: change.showAll ?? record.showAll,
    };
    return record;
  };
  return () => {
    identityClient.getInterfaceOpening = getInterfaceOpening;
    identityClient.saveInterfaceOpening = saveInterfaceOpening;
  };
};
