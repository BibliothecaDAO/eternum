import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { currentLaborDay, writeLaborGrant } from "./shard-labor";
import { handleLaborRequest } from "./labor-route";
import { grantDailyLabor } from "./relay";
import type { RelayPorts, LaborClaim } from "./ports";

const rpc = vi.hoisted(() => ({
  chain: vi.fn(),
  block: vi.fn(),
  contract: vi.fn(),
  call: vi.fn(),
  execute: vi.fn(),
  wait: vi.fn(),
}));
vi.mock("./rpc", () => ({
  rpcAt: () => ({
    getChainId: rpc.chain,
    getBlock: rpc.block,
    getClassAt: rpc.contract,
    callContract: rpc.call,
    waitForTransaction: rpc.wait,
  }),
}));
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  Account: vi.fn(function () {
    return { execute: rpc.execute };
  }),
}));
const connection = { chainId: "0x1", rpcUrl: "https://shard.test/rpc", gamesAddress: "0x10" };
const target = {
  connection,
  operatorAddress: "0x20",
  privateKey: "unused-test-key",
};
const claim: LaborClaim = {
  chainId: "0x1",
  gameId: 7,
  realmId: "8",
  home: "9",
  day: 0,
  realmsId: "0x2",
  account: "0x123",
};
const realmType = {
  type: "struct",
  name: "world_native::entry::LaborRealm",
  members: [
    { name: "game_id", type: "core::integer::u32" },
    { name: "realm_id", type: "core::integer::u32" },
    { name: "home", type: "core::integer::u32" },
  ],
};
const grantAbi = {
  type: "function",
  name: "grant_labor",
  inputs: [
    { name: "realm", type: realmType.name },
    { name: "day", type: "core::integer::u64" },
    { name: "account", type: "core::starknet::contract_address::ContractAddress" },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  rpc.chain.mockResolvedValue("0x1");
  rpc.block.mockResolvedValue({
    status: "ACCEPTED_ON_L2",
    block_number: 10,
    block_hash: "0xa",
    parent_hash: "0x9",
    timestamp: 1000,
  });
  rpc.contract.mockResolvedValue({ abi: [realmType, grantAbi] });
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("writes the published direct grant and returns a zero grant without treating it as a missing result", async () => {
  let reads = 0;
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator" ? ["0x20"] : reads++ === 0 ? ["1"] : ["0", "0x123", "9", "0"],
  );
  expect(await Effect.runPromise(writeLaborGrant(target, claim))).toEqual({ account: "0x123", home: "9", amount: "0" });
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "grant_labor",
    calldata: ["7", "8", "9", "0", "0x123"],
  });
});
it("uses the immutable exact retry and refuses a conflicting home or disabled operator", async () => {
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator" ? ["0x20"] : ["0", "0x123", "9", "1000"],
  );
  await Effect.runPromise(writeLaborGrant(target, claim));
  expect(rpc.execute).not.toHaveBeenCalled();
  await expect(Effect.runPromise(writeLaborGrant(target, { ...claim, home: "10" }))).rejects.toThrow();
  rpc.call.mockResolvedValue(["0x0"]);
  await expect(Effect.runPromise(writeLaborGrant(target, claim))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("fails closed on an unpublished widened home ABI or on reverted grants", async () => {
  rpc.contract.mockResolvedValue({
    abi: [
      grantAbi,
      {
        ...realmType,
        members: realmType.members.map((member) =>
          member.name === "home" ? { ...member, type: "core::integer::u64" } : member,
        ),
      },
    ],
  });
  await expect(Effect.runPromise(writeLaborGrant(target, claim))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.contract.mockResolvedValue({ abi: [realmType, grantAbi] });
  rpc.call.mockImplementation(async (request) => (request.entrypoint === "ledger_operator" ? ["0x20"] : ["1"]));
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(writeLaborGrant(target, claim))).rejects.toThrow();
});
it("holds the public route closed until the global labor day interface is published", async () => {
  const grant = vi.fn(async () => ({ account: "0x123", home: "9", amount: "0" }));
  const response = await handleLaborRequest(
    new Request("https://play.test/api/value/labor", {
      method: "POST",
      headers: { origin: "https://play.test", "content-type": "application/json" },
      body: JSON.stringify({ gameId: 7, realmId: 8, home: "9" }),
    }),
    {
      origin: "https://play.test",
      chainId: "0x1",
      authenticate: async () => ({ realmsId: "0x2", account: "0x123" }),
      currentDay: currentLaborDay,
      grant,
    },
  );
  expect(response.status).toBe(503);
  expect(grant).not.toHaveBeenCalled();
});
it("authenticates the public request, rejects account/day injection and checks current wallet NFT ownership before writing", async () => {
  const write = vi.fn(() => Effect.succeed({ account: "0x123", home: "9", amount: "0" }));
  const ports = {
    identity: { linkedWallet: () => Effect.succeed("0x456") },
    realms: { ownerOf: () => Effect.succeed("0x456") },
    shard: { grantLabor: write },
  } as unknown as RelayPorts;
  const dependencies = {
    origin: "https://play.test",
    chainId: "0x1",
    authenticate: vi.fn(async () => ({ realmsId: "0x2", account: "0x123" })),
    currentDay: () => Effect.succeed(5),
    grant: (claim: LaborClaim) => Effect.runPromise(grantDailyLabor(ports, claim)),
  };
  const request = (body: unknown, origin = "https://play.test") =>
    new Request("https://play.test/api/value/labor", {
      method: "POST",
      headers: { origin, cookie: "test-cookie", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const response = await handleLaborRequest(request({ gameId: 7, realmId: 8, home: "9" }), dependencies);
  expect(response.status).toBe(200);
  expect(write).toHaveBeenCalledWith({ ...claim, day: 5 });
  expect(dependencies.authenticate).toHaveBeenCalledWith("test-cookie");
  expect((await handleLaborRequest(request({ gameId: 7, realmId: 8, home: "9", day: 0 }), dependencies)).status).toBe(
    400,
  );
  expect(
    (await handleLaborRequest(request({ gameId: 7, realmId: 8, home: "9" }, "https://other.test"), dependencies))
      .status,
  ).toBe(403);
  ports.realms.ownerOf = () => Effect.succeed("0x999");
  expect((await handleLaborRequest(request({ gameId: 7, realmId: 8, home: "9" }), dependencies)).status).toBe(409);
  expect(write).toHaveBeenCalledOnce();
});

it("never reads a day or writes a grant for a signed-out caller", async () => {
  const currentDay = vi.fn(() => Effect.succeed(0));
  const grant = vi.fn(async () => ({ account: "0x123", home: "9", amount: "0" }));
  const request = new Request("https://play.test/api/value/labor", {
    method: "POST",
    headers: { origin: "https://play.test", "content-type": "application/json" },
    body: JSON.stringify({ gameId: 7, realmId: 8, home: "9" }),
  });
  expect(
    (
      await handleLaborRequest(request, {
        origin: "https://play.test",
        chainId: "0x1",
        authenticate: async () => null,
        currentDay,
        grant,
      })
    ).status,
  ).toBe(401);
  expect(currentDay).not.toHaveBeenCalled();
  expect(grant).not.toHaveBeenCalled();
});
