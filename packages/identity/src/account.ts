import { computeHashOnElements, poseidonHashMany } from "@scure/starknet";

/**
 * The arithmetic of a Realms account, shared by the identity Worker, the guardian, the launch Worker and every tool
 * that approves devices under its own guardian. It uses @scure/starknet, which the game already ships, so importing it
 * adds no second Starknet library, and its own entry keeps it off the identity client's import path.
 */

/** One device change on one Realms account on one chain, as `RealmsAccount` checks it. */
export interface DeviceChange {
  chainId: string;
  account: string;
  action: "ADD" | "REVOKE";
  deviceKey: string;
  counter: number;
}

const shortString = (text: string): bigint =>
  BigInt(`0x${[...text].map((character) => character.charCodeAt(0).toString(16).padStart(2, "0")).join("")}`);

const toHex = (value: bigint | string): string => `0x${BigInt(value).toString(16)}`;

const CONTRACT_ADDRESS_PREFIX = shortString("STARKNET_CONTRACT_ADDRESS");
const ADDRESS_BOUND = 2n ** 251n - 256n;
const DEVICE_CHANGE = shortString("REALMS_DEVICE_CHANGE");

/**
 * A Realms account's gameplay account on a shard: deployed with salt = Realms id and constructor
 * (realms_id, guardian_public_key) from no deployer, so it has the same address on every shard that runs the same
 * account class and guardian.
 */
export const realmsAccountAddress = (realmsId: string, accountClassHash: string, guardianPublicKey: string): string => {
  const constructorHash = computeHashOnElements([realmsId, guardianPublicKey]);
  const address = computeHashOnElements([CONTRACT_ADDRESS_PREFIX, 0n, realmsId, accountClassHash, constructorHash]);
  // Pedersen over felts returns a hex string; the declared union also admits bytes.
  return toHex(BigInt(address as string) % ADDRESS_BOUND);
};

/** `device_change_hash` in contracts/l3/player-account/src/realms_account.cairo: what a guardian signs. */
export const deviceChangeHash = (change: DeviceChange): string =>
  toHex(
    poseidonHashMany([
      DEVICE_CHANGE,
      BigInt(change.chainId),
      BigInt(change.account),
      shortString(change.action),
      BigInt(change.deviceKey),
      BigInt(change.counter),
    ]),
  );
