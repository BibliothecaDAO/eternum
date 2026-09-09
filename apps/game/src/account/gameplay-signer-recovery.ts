import { toast } from "@/ui/features/event-feed/notify";
import { readGameplayAccountPublicKey, type GameplayAccountApi } from "@bibliothecadao/eternum";
import type { ProviderInterface } from "starknet";

/** Rotation must precede bind: the binding endpoint verifies the current on-chain public key. */
export async function rotateBoundGameplaySigner(
  api: GameplayAccountApi,
  address: string,
  publicKey: string,
): Promise<void> {
  const rotatedAccount = await api.rotate(publicKey);
  if (BigInt(rotatedAccount) !== BigInt(address))
    throw new Error("Binding authority rotated an unexpected gameplay account");
  await api.bind(address, publicKey);
}

export async function recoverGameplaySigner({
  provider,
  address,
  publicKey,
  api,
  isCurrent,
}: {
  provider: ProviderInterface;
  address: string;
  publicKey: string;
  api: GameplayAccountApi;
  isCurrent: () => boolean;
}): Promise<boolean> {
  if (!isCurrent()) return false;
  const onChainKey = await readGameplayAccountPublicKey(provider, address);
  if (BigInt(onChainKey) === BigInt(publicKey) || !isCurrent()) return false;
  await rotateBoundGameplaySigner(api, address, publicKey);
  if (!isCurrent()) return false;
  toast.warning("This game was signed in elsewhere. This tab took control.", { duration: 0 });
  return true;
}
