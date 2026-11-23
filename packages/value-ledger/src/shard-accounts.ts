import { botRealmsId, realmsAccountAddress } from "../../identity/src/account";
import { shortString } from "starknet";

export const LAUNCHER_LABEL = shortString.encodeShortString("ETERNUM_LAUNCHER");
export const RELAY_LABEL = shortString.encodeShortString("ETERNUM_VALUE_RELAY");
type Identity = { accountClassHash: string; guardianPublicKey: string };

export const launcherAccountAddress = (shard: Identity) =>
  realmsAccountAddress(botRealmsId(LAUNCHER_LABEL), shard.accountClassHash, shard.guardianPublicKey);
export const relayAccountAddress = (shard: Identity) =>
  realmsAccountAddress(botRealmsId(RELAY_LABEL), shard.accountClassHash, shard.guardianPublicKey);
