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
const slotState = (cancelled = false) =>
  response(ledgerAbi, "get_slot", {
    season_id: 1,
    exists: true,
    preset_id: 2,
    close: 100,
    end: 200,
    pool: { low: 500, high: 0 },
    registered_count: 1,
    cancelled,
  });
const fixture = () => {
  const first = vi.fn().mockResolvedValue({ address: "0xa1", walletLinkedAt: 1 });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  const fetch = vi.fn(async (_url: string, _options?: unknown) =>
    Response.json({ name: "noon", chainId: "0xa", slotId: 7 }),
  );
  const env = {
    DB: { prepare },
    LAUNCH: { fetch },
    ENVIRONMENT: "staging",
    IDENTITY_RPC_URL: "https://starknet-sepolia.g.alchemy.com/v2/test",
  } as unknown as IdentityEnv;
  return { env, first, bind, fetch };
};
beforeEach(() => {
  rpc.callContract
    .mockReset()
    .mockImplementation(async ({ entrypoint }) => (entrypoint === "get_slot" ? slotState() : registration()));
  rpc.getChainId.mockReset().mockResolvedValue(encodeChainName("SN_SEPOLIA"));
  addressBook.ledger = "0x123";
});
it("admits the current registered wallet with keyed registration and cancellation reads and no roster scan", async () => {
  const { env, fetch, bind } = fixture();
  expect(await readRoomAccess(env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: true });
  expect(bind).toHaveBeenCalledWith("0x1");
  expect(fetch).toHaveBeenCalledExactlyOnceWith("https://launch/api/slots/noon?chainId=0xa", expect.any(Object));
  expect(rpc.callContract).toHaveBeenCalledTimes(2);
  expect(rpc.callContract).toHaveBeenCalledWith(
    { contractAddress: "0x123", entrypoint: "get_registration", calldata: ["0xa", "7", "0xa1"] },
    "latest",
  );
  expect(rpc.callContract.mock.calls[0]![0].calldata.map(BigInt)).toEqual(
    ledgerCall("get_registration", { key: { shard: 10, slot_id: 7 }, owner: 161 }).map(BigInt),
  );
});
it.each([
  ["marked refundable but not yet refunded", { refundable: true }],
  ["unregistered", { registered: false, paid: { low: 0, high: 0 } }],
  ["refunded (registered remains true)", { refundable: true, paid: { low: 0, high: 0 } }],
  ["cancelled slot refund (refundable can remain false)", { paid: { low: 0, high: 0 } }],
])("refuses a %s wallet", async (_, overrides) => {
  rpc.callContract.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "get_slot" ? slotState() : registration(overrides),
  );
  expect(await readRoomAccess(fixture().env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: false });
});
it("refuses an unrefunded registration in a cancelled slot", async () => {
  rpc.callContract.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "get_slot" ? slotState(true) : registration(),
  );
  expect(await readRoomAccess(fixture().env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: false });
});
it("keeps identically named lobbies on two shards separate and refuses a wrong-chain reply", async () => {
  const { env, fetch } = fixture();
  fetch.mockImplementation(async (url: string) =>
    Response.json({ name: "noon", chainId: new URL(url).searchParams.get("chainId"), slotId: 7 }),
  );
  await readRoomAccess(env, "0x1", "slot:0xa:noon");
  await readRoomAccess(env, "0x1", "slot:0xb:noon");
  expect(
    rpc.callContract.mock.calls
      .filter(([request]) => request.entrypoint === "get_registration")
      .map(([request]) => request.calldata[0]),
  ).toEqual(["0xa", "0xb"]);
  fetch.mockResolvedValue(Response.json({ name: "noon", chainId: "0xb", slotId: 7 }));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({
    code: "chat_membership_unavailable",
  });
});
it("uses a changed current wallet, not the registration-time wallet or session", async () => {
  const { env, first } = fixture();
  rpc.callContract.mockImplementation(async ({ entrypoint, calldata }) =>
    entrypoint === "get_slot"
      ? slotState()
      : registration(BigInt(calldata[2]) === 161n ? {} : { registered: false, paid: { low: 0, high: 0 } }),
  );
  expect(await readRoomAccess(env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: true });
  first.mockResolvedValue({ address: "0xb2", walletLinkedAt: 2 });
  expect(await readRoomAccess(env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: false });
  expect(rpc.callContract.mock.calls[2]![0].calldata[2]).toBe("0xb2");
});
it("allows no linked wallet to read without making a ledger request", async () => {
  const { env, first } = fixture();
  for (const user of [null, { address: null, walletLinkedAt: null }]) {
    first.mockResolvedValue(user);
    expect(await readRoomAccess(env, "0x1", "slot:0xa:noon")).toEqual({ canWrite: false });
  }
  expect(rpc.callContract).not.toHaveBeenCalled();
});
it("fails loud and closed if identity, ledger, chain verification or deployment is unavailable", async () => {
  const { env, first } = fixture();
  const unavailable = { status: 503, code: "chat_membership_unavailable" };
  first.mockRejectedValueOnce(new Error("D1 unavailable"));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject(unavailable);
  rpc.callContract.mockRejectedValueOnce(new Error("RPC unavailable"));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject(unavailable);
  rpc.callContract.mockResolvedValueOnce(["0x1"]);
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject(unavailable);
  rpc.getChainId.mockResolvedValueOnce(encodeChainName("SN_MAIN"));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject(unavailable);
  addressBook.ledger = null;
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject(unavailable);
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
    await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({
      code: "chat_membership_unavailable",
      status: 503,
    });
  }
  fetch.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({ status: 404 });
  fetch.mockRejectedValue(new Error("timed out"));
  await expect(readRoomAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({ status: 503 });
  expect(rpc.callContract).not.toHaveBeenCalled();
});
it("reads slot history without consulting identity linkage or the ledger", async () => {
  const { env, first, fetch } = fixture();
  first.mockRejectedValue(new Error("wallet link unavailable"));
  rpc.callContract.mockRejectedValue(new Error("ledger unavailable"));
  await expect(requireRoomReadAccess(env, "0x1", "slot:0xa:noon")).resolves.toBeUndefined();
  expect(first).not.toHaveBeenCalled();
  expect(rpc.callContract).not.toHaveBeenCalled();
  expect(rpc.getChainId).not.toHaveBeenCalled();
  fetch.mockResolvedValue(new Response(null, { status: 404 }));
  await expect(requireRoomReadAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({
    code: "channel_not_found",
    status: 404,
  });
  fetch.mockRejectedValue(new Error("launch unavailable"));
  await expect(requireRoomReadAccess(env, "0x1", "slot:0xa:noon")).rejects.toMatchObject({
    code: "chat_membership_unavailable",
    status: 503,
  });
});
it("accepts exactly the existing slot-name grammar", () => {
  expect(parseChatRoom("slot:0xa:a")).toBe("slot:0xa:a");
  expect(parseChatRoom(`slot:0xa:${"a".repeat(24)}`)).not.toBeNull();
  for (const name of ["", "-noon", "NOON", "noon:other", "a".repeat(25)])
    expect(parseChatRoom(`slot:0xa:${name}`)).toBeNull();
});
