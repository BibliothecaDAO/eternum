import { expect, it, vi } from "vitest";
import type { IdentityEnv } from "../env";
import { readRoomAccess } from "./room-access";
import { parseChatRoom } from "./rooms";

it("fails closed on malformed slot rosters and never treats an invited account as a Realms seat", async () => {
  const fetch = vi.fn(async () => Response.json({ name: "noon", registrations: [{ realmsId: null, account: "0x1" }] }));
  const env = { LAUNCH: { fetch } } as unknown as IdentityEnv;
  expect(await readRoomAccess(env, "0x1", "slot:noon")).toEqual({ canWrite: false });
  for (const body of [
    {},
    { name: "noon" },
    { name: "noon", registrations: [{ realmsId: "broken" }] },
    { name: "other", registrations: [{ realmsId: "0x1" }] },
  ]) {
    fetch.mockResolvedValue(Response.json(body));
    await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({
      status: 503,
    });
  }
  fetch.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({ status: 404 });
  fetch.mockRejectedValue(new Error("timed out"));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({ status: 503 });
});

it("accepts exactly the existing slot-name grammar", () => {
  expect(parseChatRoom("slot:a")).toBe("slot:a");
  expect(parseChatRoom(`slot:${"a".repeat(24)}`)).not.toBeNull();
  for (const name of ["", "-noon", "NOON", "noon:other", "a".repeat(25)])
    expect(parseChatRoom(`slot:${name}`)).toBeNull();
});
