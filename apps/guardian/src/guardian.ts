import { ec, hash, num, shortString } from "starknet";

/** One device change on one Realms account on one chain, as `RealmsAccount` checks it. */
export interface DeviceChange {
  chainId: string;
  account: string;
  action: "ADD" | "REVOKE";
  deviceKey: string;
  counter: number;
}

export interface GuardianSignature {
  r: string;
  s: string;
}

/** What the guardian offers the identity Worker: its public key and a signature over a device change, nothing else. */
export interface Guardian {
  publicKey(): Promise<string>;
  signDeviceChange(change: DeviceChange): Promise<GuardianSignature>;
}

const DEVICE_CHANGE = shortString.encodeShortString("REALMS_DEVICE_CHANGE");

/** `device_change_hash` in contracts/l3/player-account/src/realms_account.cairo. */
export const deviceChangeHash = (change: DeviceChange): string =>
  hash.computePoseidonHashOnElements([
    DEVICE_CHANGE,
    change.chainId,
    change.account,
    shortString.encodeShortString(change.action),
    change.deviceKey,
    change.counter,
  ]);

/** The guardian computes the message itself, so its key can only ever approve a device change. */
export const createGuardian = (privateKey: string): Guardian => ({
  publicKey: async () => ec.starkCurve.getStarkKey(privateKey),
  signDeviceChange: async (change) => {
    const signature = ec.starkCurve.sign(deviceChangeHash(change), privateKey);
    return { r: num.toHex(signature.r), s: num.toHex(signature.s) };
  },
});
