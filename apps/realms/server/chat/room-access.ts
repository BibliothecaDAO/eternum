import { BLITZ_SLOT_NAME_PATTERN } from "@realms-world/identity";
import { environmentL2 } from "@realms-world/chain";
import { readLedgerRegistration } from "@realms-world/value-ledger";
import { identityProvider, verifyIdentityChain } from "../l2";
import { readLinkedWallet } from "../payout-wallet";
import { z } from "zod";
import type { IdentityEnv } from "../env";
import { isRoomMember, type ChatRoomId } from "./rooms";

const SlotKey = z.object({
  name: z.string().regex(BLITZ_SLOT_NAME_PATTERN),
  chainId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{1,64}$/)
    .refine((value) => BigInt(value) > 0n),
  slotId: z.number().int().nonnegative().max(0xffffffff),
});
type RoomAccessEnv = Pick<IdentityEnv, "DB" | "LAUNCH" | "ENVIRONMENT" | "IDENTITY_RPC_URL">;

export class ChatAccessError extends Error {
  constructor(
    public readonly code: "channel_access_denied" | "channel_not_found" | "chat_membership_unavailable",
    public readonly status: 403 | 404 | 503,
  ) {
    super(code);
  }
}

/** Slot writers use their current linked wallet's ledger registration; game rooms use the shard roster. */
export async function readRoomAccess(
  env: RoomAccessEnv,
  realmsId: string,
  room: ChatRoomId,
): Promise<{ canWrite: boolean }> {
  if (room.startsWith("slot:")) return readSlotAccess(env, realmsId, room.slice(5));
  if (!(await isRoomMember(env.DB, realmsId, room))) throw new ChatAccessError("channel_access_denied", 403);
  return { canWrite: true };
}

async function readSlotAccess(env: RoomAccessEnv, realmsId: string, name: string) {
  try {
    const slot = await readSlotKey(env.LAUNCH, name);
    const wallet = (await readLinkedWallet(env.DB, realmsId))?.address;
    if (!wallet) return { canWrite: false };
    const { ledger } = environmentL2(env.ENVIRONMENT);
    if (!ledger) throw new Error("Slot ledger is not deployed");
    const provider = identityProvider(env);
    await verifyIdentityChain(provider, env);
    const registration = await readLedgerRegistration(provider, ledger, slot, wallet);
    return {
      canWrite:
        registration.registered && (registration.paid > 0n || registration.swordCredit || registration.shieldCredit),
    };
  } catch (error) {
    if (error instanceof ChatAccessError) throw error;
    throw new ChatAccessError("chat_membership_unavailable", 503);
  }
}

async function readSlotKey(launch: IdentityEnv["LAUNCH"], name: string) {
  const response = await launch.fetch(`https://launch/api/slots/${name}`, {
    signal: AbortSignal.timeout(5_000),
    redirect: "manual",
  });
  if (response.status === 404) throw new ChatAccessError("channel_not_found", 404);
  if (!response.ok) throw new Error(`Slot directory answered ${response.status}`);
  const slot = SlotKey.parse(await response.json());
  if (slot.name !== name) throw new Error("Slot directory answered for another room");
  return slot;
}
