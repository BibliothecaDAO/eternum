import { beforeEach, expect, it, vi } from "vitest";
import { encodeChainName } from "@realms-world/chain";
import { response } from "../../../../packages/value-ledger/test-support/abi";
import { ledgerAbi, ledgerCall } from "../../../../packages/value-ledger/test-support/ledger-abi";
import type { IdentityEnv } from "../env";
import { readRoomAccess, requireRoomReadAccess } from "./room-access";
import { parseChatRoom } from "./rooms";

const rpc = vi.hoisted(() => ({ callContract: vi.fn(), getChainId: vi.fn() }));
const addressBook = vi.hoisted(() => ({ ledger: "0x123" as string | null }));
vi.mock("../l2", async (original) => ({ ...(await original<typeof import("../l2")>()), identityProvider: () => rpc }));
vi.mock("@realms-world/chain", async (original) => {
  const chain = await original<typeof import("@realms-world/chain")>();
  return {
    ...chain,
    environmentL2: (env: "staging" | "production") => ({ ...chain.environmentL2(env), ledger: addressBook.ledger }),
  };
});
const registration = (overrides: Record<string, unknown> = {}) =>
  response(ledgerAbi, "get_registration", {
    registered: true,
    sword: false,
    shield: false,
    sword_credit: false,
    shield_credit: false,
    paid: { low: 500, high: 0 },
    refundable: false,
    game_id: 0,
    ...overrides,
  });
const fixture = () => {
  const first = vi.fn().mockResolvedValue({ address: "0xa1", walletLinkedAt: 1 });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  const fetch = vi.fn(async () => Response.json({ name: "noon", chainId: "0xa", slotId: 7 }));
  const env = {
    DB: { prepare },
    LAUNCH: { fetch },
    ENVIRONMENT: "staging",
    IDENTITY_RPC_URL: "https://starknet-sepolia.g.alchemy.com/v2/test",
  } as unknown as IdentityEnv;
  return { env, first, bind, fetch };
};
beforeEach(() => {
  rpc.callContract.mockReset().mockResolvedValue(registration());
  rpc.getChainId.mockReset().mockResolvedValue(encodeChainName("SN_SEPOLIA"));
  addressBook.ledger = "0x123";
});
it("admits the current registered wallet with one keyed ledger read and no roster scan", async () => {
  const { env, fetch, bind } = fixture();
  expect(await readRoomAccess(env, "0x1", "slot:noon")).toEqual({ canWrite: true });
  expect(bind).toHaveBeenCalledWith("0x1");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(rpc.callContract).toHaveBeenCalledExactlyOnceWith(
    { contractAddress: "0x123", entrypoint: "get_registration", calldata: ["0xa", "7", "0xa1"] },
    "latest",
  );
  expect(rpc.callContract.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("get_registration", { key: { shard: 10, slot_id: 7 }, owner: 161 }).map(BigInt),
  );
});
it.each([
  ["unregistered", { registered: false, paid: { low: 0, high: 0 } }],
  ["refunded (registered remains true)", { refundable: true, paid: { low: 0, high: 0 } }],
  ["cancelled slot refund (refundable can remain false)", { paid: { low: 0, high: 0 } }],
])("refuses a %s wallet", async (_, overrides) => {
  rpc.callContract.mockResolvedValue(registration(overrides));
  expect(await readRoomAccess(fixture().env, "0x1", "slot:noon")).toEqual({ canWrite: false });
});
it("uses a changed current wallet, not the registration-time wallet or session", async () => {
  const { env, first } = fixture();
  rpc.callContract.mockImplementation(async ({ calldata }) =>
    registration(BigInt(calldata[2]) === 161n ? {} : { registered: false, paid: { low: 0, high: 0 } }),
  );
  expect(await readRoomAccess(env, "0x1", "slot:noon")).toEqual({ canWrite: true });
  first.mockResolvedValue({ address: "0xb2", walletLinkedAt: 2 });
  expect(await readRoomAccess(env, "0x1", "slot:noon")).toEqual({ canWrite: false });
  expect(rpc.callContract.mock.calls[1]![0].calldata[2]).toBe("0xb2");
});
it("allows no linked wallet to read without making a ledger request", async () => {
  const { env, first } = fixture();
  for (const user of [null, { address: null, walletLinkedAt: null }]) {
    first.mockResolvedValue(user);
    expect(await readRoomAccess(env, "0x1", "slot:noon")).toEqual({ canWrite: false });
  }
  expect(rpc.callContract).not.toHaveBeenCalled();
});
it("fails loud and closed if identity, ledger, chain verification or deployment is unavailable", async () => {
  const { env, first } = fixture();
  const unavailable = { status: 503, code: "chat_membership_unavailable" };
  first.mockRejectedValueOnce(new Error("D1 unavailable"));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject(unavailable);
  rpc.callContract.mockRejectedValueOnce(new Error("RPC unavailable"));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject(unavailable);
  rpc.callContract.mockResolvedValueOnce(["0x1"]);
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject(unavailable);
  rpc.getChainId.mockResolvedValueOnce(encodeChainName("SN_MAIN"));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject(unavailable);
  addressBook.ledger = null;
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject(unavailable);
});
it("rejects missing or malformed slot keys and unavailable launch metadata", async () => {
  const { env, fetch } = fixture();
  for (const body of [
    {},
    { name: "noon", registrations: [] },
    { name: "other", chainId: "0xa", slotId: 7 },
    { name: "noon", chainId: "0x0", slotId: 7 },
    { name: "noon", chainId: "0xa", slotId: -1 },
  ]) {
    fetch.mockResolvedValue(Response.json(body));
    await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({
      code: "chat_membership_unavailable",
      status: 503,
    });
  }
  fetch.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({ status: 404 });
  fetch.mockRejectedValue(new Error("timed out"));
  await expect(readRoomAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({ status: 503 });
  expect(rpc.callContract).not.toHaveBeenCalled();
});
it("reads slot history without consulting identity linkage or the ledger", async () => {
  const { env, first, fetch } = fixture();
  first.mockRejectedValue(new Error("wallet link unavailable"));
  rpc.callContract.mockRejectedValue(new Error("ledger unavailable"));
  await expect(requireRoomReadAccess(env, "0x1", "slot:noon")).resolves.toBeUndefined();
  expect(first).not.toHaveBeenCalled();
  expect(rpc.callContract).not.toHaveBeenCalled();
  expect(rpc.getChainId).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(requireRoomReadAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({
    code: "channel_not_found",
    status: 404,
  });
  fetch.mockRejectedValue(new Error("launch unavailable"));
  await expect(requireRoomReadAccess(env, "0x1", "slot:noon")).rejects.toMatchObject({
    code: "chat_membership_unavailable",
    status: 503,
  });
});
it("accepts exactly the existing slot-name grammar", () => {
  expect(parseChatRoom("slot:a")).toBe("slot:a");
  expect(parseChatRoom(`slot:${"a".repeat(24)}`)).not.toBeNull();
  for (const name of ["", "-noon", "NOON", "noon:other", "a".repeat(25)])
    expect(parseChatRoom(`slot:${name}`)).toBeNull();
});
