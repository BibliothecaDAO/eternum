import { gamesAbi, response, hex } from "../../../packages/value-ledger/test-support/abi";
import { CallData, CairoOption, CairoOptionVariant } from "starknet";
import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";
import { currentLaborDay, writeLaborGrants } from "./shard-labor";
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
vi.mock("../../../packages/value-ledger/src/rpc", async (original) => ({
  ...(await original<typeof import("../../../packages/value-ledger/src/rpc")>()),
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
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    async admin(
      entrypoint: string,
      args: { realms: { game_id: number; realm_id: number; home: bigint }[]; day: number; account: string },
    ) {
      await rpc.execute({
        contractAddress: "0x10",
        entrypoint,
        calldata: new CallData(gamesAbi).compile(entrypoint, args).map(hex),
      });
      if ((await rpc.wait()).isReverted()) throw new Error("labor_grant_reverted");
    }
  },
}));
const connection = { chainId: "0x1", rpcUrl: "https://shard.test/rpc", gamesAddress: "0x10" };
const target = {
  connection,
  operatorAddress: "0x20",
  privateKey: "0x1",
};
const claim: LaborClaim = {
  chainId: "0x1",
  realms: [{ gameId: 7, realmId: "8", home: "9" }],
  day: 0,
  realmsId: "0x2",
  account: "0x123",
};
const realmType = gamesAbi.find((entry) => entry.name === "world_native::entry::LaborRealm")!;
const grantAbi = gamesAbi.find((entry) => entry.name === "grant_labor")!;
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
  rpc.contract.mockResolvedValue({ abi: gamesAbi });
  rpc.execute.mockResolvedValue({ transaction_hash: "0xabc" });
  rpc.wait.mockResolvedValue({ isReverted: () => false });
});
it("writes the published direct grant and returns a zero grant without treating it as a missing result", async () => {
  let reads = 0;
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator"
      ? ["0x20"]
      : reads++ === 0
        ? response(gamesAbi, "labor_grant", new CairoOption(CairoOptionVariant.None))
        : response(
            gamesAbi,
            "labor_grant",
            new CairoOption(CairoOptionVariant.Some, { game_id: 7, account: "0x123", home: 9, amount: 0 }),
          ).map(hex),
  );
  expect(await Effect.runPromise(writeLaborGrants(target, claim))).toEqual([
    {
      gameId: 7,
      account: "0x123",
      home: "9",
      amount: "0",
    },
  ]);
  expect(rpc.execute).toHaveBeenCalledWith({
    contractAddress: "0x10",
    entrypoint: "grant_labor",
    calldata: new CallData(gamesAbi)
      .compile("grant_labor", { realms: [{ game_id: 7, realm_id: 8, home: 9 }], day: 0, account: "0x123" })
      .map(hex),
  });
});
it("uses the immutable exact retry and refuses a conflicting home or disabled operator", async () => {
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator" ? ["0x20"] : ["0", "7", "0x123", "9", "1000"],
  );
  await Effect.runPromise(writeLaborGrants(target, claim));
  expect(rpc.execute).not.toHaveBeenCalled();
  await expect(
    Effect.runPromise(writeLaborGrants(target, { ...claim, realms: [{ ...claim.realms[0]!, home: "10" }] })),
  ).rejects.toThrow();
  rpc.call.mockResolvedValue(["0x0"]);
  await expect(Effect.runPromise(writeLaborGrants(target, claim))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});
it("fails closed on the retired narrow home ABI or on reverted grants", async () => {
  rpc.contract.mockResolvedValue({
    abi: [
      grantAbi,
      {
        ...realmType,
        members: realmType.members.map((member: { name: string; type: string }) =>
          member.name === "home" ? { ...member, type: "core::integer::u32" } : member,
        ),
      },
    ],
  });
  await expect(Effect.runPromise(writeLaborGrants(target, claim))).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
  rpc.contract.mockResolvedValue({ abi: gamesAbi });
  rpc.call.mockImplementation(async (request) => (request.entrypoint === "ledger_operator" ? ["0x20"] : ["1"]));
  rpc.wait.mockResolvedValue({ isReverted: () => true });
  await expect(Effect.runPromise(writeLaborGrants(target, claim))).rejects.toThrow();
});
it("derives one UTC day across all games from confirmed shard time", async () => {
  rpc.block.mockResolvedValue({
    status: "ACCEPTED_ON_L2",
    block_number: 10,
    block_hash: "0xa",
    parent_hash: "0x9",
    timestamp: 86399,
  });
  expect(await Effect.runPromise(currentLaborDay(connection))).toBe(0);
  rpc.block.mockResolvedValue({
    status: "ACCEPTED_ON_L2",
    block_number: 11,
    block_hash: "0xb",
    parent_hash: "0xa",
    timestamp: 86400,
  });
  expect(await Effect.runPromise(currentLaborDay(connection))).toBe(1);
});
it("authenticates the public request, rejects account/day injection and checks current wallet NFT ownership before writing", async () => {
  const write = vi.fn(() => Effect.succeed([{ gameId: 7, account: "0x123", home: "9", amount: "0" }]));
  const ports = {
    identity: { accountForRealmsId: () => Effect.succeed("0x123"), linkedWallet: () => Effect.succeed("0x456") },
    realms: { ownerOf: () => Effect.succeed("0x456") },
    shard: { grantLabor: write },
  } as unknown as RelayPorts;
  const dependencies = {
    origin: "https://play.test",
    chainId: "0x1",
    authenticate: vi.fn(async () => ({ realmsId: "0x2", account: "0x123" })),
    accountForRealmsId: vi.fn(async () => "0x123"),
    currentDay: () => Effect.succeed(5),
    grant: (claim: LaborClaim) => Effect.runPromise(grantDailyLabor(ports, claim)),
  };
  const request = (body: unknown, origin = "https://play.test") =>
    new Request("https://play.test/api/value/labor", {
      method: "POST",
      headers: { origin, cookie: "test-cookie", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const response = await handleLaborRequest(request({ realms: [{ gameId: 7, realmId: 8, home: "9" }] }), dependencies);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    day: 5,
    grants: [{ realmId: "8", gameId: 7, account: "0x123", home: "9", amount: "0" }],
    refused: [],
  });
  expect(write).toHaveBeenCalledWith({ ...claim, day: 5 });
  expect(dependencies.authenticate).toHaveBeenCalledWith("test-cookie");
  expect(
    (await handleLaborRequest(request({ realms: [{ gameId: 7, realmId: 8, home: "9" }], day: 0 }), dependencies))
      .status,
  ).toBe(400);
  expect(
    (
      await handleLaborRequest(
        request({ realms: [{ gameId: 7, realmId: 8, home: "9" }] }, "https://other.test"),
        dependencies,
      )
    ).status,
  ).toBe(403);
  write.mockClear();
  const realms = [8, 10, 12].map((realmId) => ({ gameId: 7, realmId, home: "9" }));
  ports.realms.ownerOf = (id) => Effect.succeed(id === "10" ? "0x456" : "0x999");
  const mixed = await handleLaborRequest(request({ realms }), dependencies);
  expect(mixed.status).toBe(200);
  expect(await mixed.json()).toEqual({
    day: 5,
    grants: [{ realmId: "10", gameId: 7, account: "0x123", home: "9", amount: "0" }],
    refused: [
      { realmId: "8", reason: "realm_not_owned" },
      { realmId: "12", reason: "realm_not_owned" },
    ],
  });
  expect(write).toHaveBeenCalledExactlyOnceWith({
    ...claim,
    day: 5,
    realms: [{ gameId: 7, realmId: "10", home: "9" }],
  });
  write.mockClear();
  ports.realms.ownerOf = () => Effect.succeed("0x999");
  const refused = await handleLaborRequest(request({ realms }), dependencies);
  expect(refused.status).toBe(409);
  expect(await refused.json()).toEqual({
    day: 5,
    error: "realm_not_owned",
    grants: [],
    refused: realms.map(({ realmId }) => ({ realmId: String(realmId), reason: "realm_not_owned" })),
  });
  expect(write).not.toHaveBeenCalled();
});

it("never reads a day or writes a grant for a signed-out caller", async () => {
  const currentDay = vi.fn(() => Effect.succeed(0));
  const grant = vi.fn(async () => ({ grants: [], refused: [] }));
  const request = new Request("https://play.test/api/value/labor", {
    method: "POST",
    headers: { origin: "https://play.test", "content-type": "application/json" },
    body: JSON.stringify({ realms: [{ gameId: 7, realmId: 8, home: "9" }] }),
  });
  expect(
    (
      await handleLaborRequest(request, {
        origin: "https://play.test",
        chainId: "0x1",
        authenticate: async () => null,
        accountForRealmsId: async () => "0x123",
        currentDay,
        grant,
      })
    ).status,
  ).toBe(401);
  expect(currentDay).not.toHaveBeenCalled();
  expect(grant).not.toHaveBeenCalled();
});

it("keeps a u64 home exact and rejects a global Realm/day claim originating in another game", async () => {
  const home = String(((2n ** 24n) << 32n) + 1n);
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator" ? ["0x20"] : ["0", "7", "0x123", home, "1000"],
  );
  expect(
    await Effect.runPromise(writeLaborGrants(target, { ...claim, realms: [{ ...claim.realms[0]!, home }] })),
  ).toMatchObject([{ home, gameId: 7 }]);
  rpc.call.mockImplementation(async (request) =>
    request.entrypoint === "ledger_operator" ? ["0x20"] : ["0", "8", "0x123", home, "1000"],
  );
  await expect(
    Effect.runPromise(writeLaborGrants(target, { ...claim, realms: [{ ...claim.realms[0]!, home }] })),
  ).rejects.toThrow();
  expect(rpc.execute).not.toHaveBeenCalled();
});

it("grants five Realms with one transaction and reuses their immutable grants on retry", async () => {
  const realms = Array.from({ length: 5 }, (_, index) => ({ gameId: 7, realmId: String(index + 1), home: "9" }));
  let submitted = false;
  rpc.call.mockImplementation(async ({ entrypoint }) =>
    entrypoint === "ledger_operator"
      ? ["0x20"]
      : response(
          gamesAbi,
          "labor_grant",
          submitted
            ? new CairoOption(CairoOptionVariant.Some, { game_id: 7, account: "0x123", home: 9, amount: 1 })
            : new CairoOption(CairoOptionVariant.None),
        ).map(hex),
  );
  rpc.execute.mockImplementation(async () => {
    submitted = true;
    return { transaction_hash: "0xabc" };
  });
  expect(await Effect.runPromise(writeLaborGrants(target, { ...claim, realms }))).toHaveLength(5);
  expect(rpc.execute).toHaveBeenCalledOnce();
  expect(rpc.execute.mock.calls[0]![0].calldata).toEqual(
    new CallData(gamesAbi)
      .compile("grant_labor", {
        realms: realms.map((realm) => ({
          game_id: realm.gameId,
          realm_id: Number(realm.realmId),
          home: BigInt(realm.home),
        })),
        day: 0,
        account: claim.account,
      })
      .map(hex),
  );
  expect(await Effect.runPromise(writeLaborGrants(target, { ...claim, realms }))).toHaveLength(5);
  expect(rpc.execute).toHaveBeenCalledOnce();
});
it.each([
  { realms: [] },
  { realms: Array.from({ length: 101 }, (_, i) => ({ gameId: 7, realmId: i + 1, home: "9" })) },
  {
    realms: [
      { gameId: 7, realmId: 8, home: "9" },
      { gameId: 7, realmId: 8, home: "9" },
    ],
  },
])("rejects an empty, oversized or duplicate Realm batch before granting", async ({ realms }) => {
  const grant = vi.fn();
  const response = await handleLaborRequest(
    new Request("https://play.test/api/value/labor", {
      method: "POST",
      headers: { origin: "https://play.test" },
      body: JSON.stringify({ realms }),
    }),
    {
      origin: "https://play.test",
      chainId: "0x1",
      authenticate: async () => ({ realmsId: "0x2" }),
      accountForRealmsId: async () => "0x123",
      currentDay: () => Effect.succeed(0),
      grant,
    },
  );
  expect(response.status).toBe(400);
  expect(grant).not.toHaveBeenCalled();
});
