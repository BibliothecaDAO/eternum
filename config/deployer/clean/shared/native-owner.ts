import type { Account, BlockIdentifier } from "starknet";

/** Reads are valid after handoff; a new owner write requires the caller's currently enrolled device. */
export async function assertNativeOwnerSigner(
  account: Pick<Account, "address" | "signer" | "callContract">,
  world: string,
  block: BlockIdentifier = "latest",
): Promise<void> {
  const [owner] = await account.callContract({ contractAddress: world, entrypoint: "owner", calldata: [] }, block);
  if (!owner || BigInt(owner) !== BigInt(account.address)) throw new Error("Current Games owner signer required");
  const deviceKey = await account.signer.getPubKey();
  const [active] = await account.callContract(
    { contractAddress: account.address, entrypoint: "is_device", calldata: [deviceKey] },
    block,
  );
  if (!active || BigInt(active) !== 1n) throw new Error("Current Games owner device is not enrolled");
}
