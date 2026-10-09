import { BLITZ_SLOT_NAME_PATTERN } from "@realms-world/identity";
import { z } from "zod";
import type { IdentityEnv } from "../env";
import { isRoomMember, type ChatRoomId } from "./rooms";

const SlotRoster = z.object({
  name: z.string().regex(BLITZ_SLOT_NAME_PATTERN),
  registrations: z.array(
    z.object({
      realmsId: z
        .string()
        .regex(/^0x[0-9a-fA-F]{1,64}$/)
        .nullable(),
    }),
  ),
});

export class ChatAccessError extends Error {
  constructor(
    public readonly code: "channel_access_denied" | "channel_not_found" | "chat_membership_unavailable",
    public readonly status: 403 | 404 | 503,
  ) {
    super(code);
  }
}

/** A slot's readers need a session; its writers need a seat in the launch Worker's authoritative roster. */
export async function readRoomAccess(
  env: Pick<IdentityEnv, "DB" | "LAUNCH">,
  realmsId: string,
  room: ChatRoomId,
): Promise<{ canWrite: boolean }> {
  if (room.startsWith("slot:")) return readSlotAccess(env.LAUNCH, realmsId, room.slice(5));
  if (!(await isRoomMember(env.DB, realmsId, room))) throw new ChatAccessError("channel_access_denied", 403);
  return { canWrite: true };
}

async function readSlotAccess(launch: IdentityEnv["LAUNCH"], realmsId: string, name: string) {
  let slot: z.infer<typeof SlotRoster>;
  try {
    const response = await launch.fetch(`https://launch/api/slots/${name}`, {
      signal: AbortSignal.timeout(5_000),
      redirect: "manual",
    });
    if (response.status === 404) throw new ChatAccessError("channel_not_found", 404);
    if (!response.ok) throw new Error(`Slot directory answered ${response.status}`);
    slot = SlotRoster.parse(await response.json());
    if (slot.name !== name) throw new Error("Slot roster answered for another room");
  } catch (error) {
    if (error instanceof ChatAccessError) throw error;
    throw new ChatAccessError("chat_membership_unavailable", 503);
  }
  return {
    canWrite: slot.registrations.some((seat) => seat.realmsId !== null && BigInt(seat.realmsId) === BigInt(realmsId)),
  };
}
