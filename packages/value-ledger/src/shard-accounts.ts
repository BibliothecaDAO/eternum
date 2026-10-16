import { botRealmsId, realmsAccountAddress } from "../../identity/src/account";
import { shortString } from "starknet";

export const LAUNCHER_LABEL = shortString.encodeShortString("ETERNUM_LAUNCHER");
export const RELAY_LABEL = shortString.encodeShortString("ETERNUM_VALUE_RELAY");
type Identity = { accountClassHash: string; guardianPublicKey: string };

export const launcherAccountAddress = (shard: Identity) =>
  realmsAccountAddress(botRealmsId(LAUNCHER_LABEL), shard.accountClassHash, shard.guardianPublicKey);
export const relayAccountAddress = (shard: Identity) =>
  realmsAccountAddress(botRealmsId(RELAY_LABEL), shard.accountClassHash, shard.guardianPublicKey);

/**
 * The pool of accounts that seat fixed rosters, one stream each: a game names one of them at creation, and only it
 * seats the game. Seats of different games share no state, so the shard executes the pool's seats side by side.
 */
const SEATER_POOL_SIZE = 16;
export const seaterLabels = Array.from({ length: SEATER_POOL_SIZE }, (_, index) =>
  shortString.encodeShortString(`ETERNUM_SEATER_${index}`),
);
export const seaterAccountAddresses = (shard: Identity) =>
  seaterLabels.map((label) =>
    realmsAccountAddress(botRealmsId(label), shard.accountClassHash, shard.guardianPublicKey),
  );
