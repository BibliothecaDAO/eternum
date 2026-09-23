import { deviceChangeHash, type DeviceChange } from "@realms-world/identity/account";
import { ec, num } from "starknet";

export interface GuardianSignature {
  r: string;
  s: string;
}

/** What the guardian offers the identity Worker: its public key and a signature over a device change, nothing else. */
export interface Guardian {
  publicKey(): Promise<string>;
  signDeviceChange(change: DeviceChange): Promise<GuardianSignature>;
}

/** The guardian computes the message itself, so its key can only ever approve a device change. */
export const createGuardian = (privateKey: string): Guardian => ({
  publicKey: async () => ec.starkCurve.getStarkKey(privateKey),
  signDeviceChange: async (change) => {
    const signature = ec.starkCurve.sign(deviceChangeHash(change), privateKey);
    return { r: num.toHex(signature.r), s: num.toHex(signature.s) };
  },
});
