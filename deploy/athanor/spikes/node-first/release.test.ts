import { test, expect } from "bun:test";
import { burst } from "./run";
import { presign, normalize } from "./common";
import { RpcProvider, ec } from "starknet";

test("presigning freezes a Realms device signature and the same invoke hash", async () => {
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:38000" });
  provider.getNonceForAddress = async () => "0x1";
  const signed = await presign(
    {
      chainId: "0x1",
      contract: "0x123",
      accountClassHash: "0x1",
      classHash: "0x1",
      guardianPublicKey: "0x1",
      players: [],
    },
    { address: "0x456", privateKey: "0x1", publicKey: "0x1", botId: 0 },
    provider,
    1,
    0,
    32,
    256,
  );
  const t = JSON.parse(signed.body).params[0];
  expect(t.calldata.length).toBe(9);
  expect(t.signature.length).toBe(3);
  expect(
    ec.starkCurve.verify(
      new ec.starkCurve.Signature(BigInt(t.signature[1]), BigInt(t.signature[2])),
      signed.hash,
      ec.starkCurve.getPublicKey("0x1", true),
    ),
  ).toBe(true);
});

test("2000 preserialized requests release once on eight warmed senders", async () => {
  let submitted = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 120,
    async fetch(request) {
      const call = await request.json();
      if (call.method === "starknet_addInvokeTransaction") submitted++;
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        result: call.method === "starknet_chainId" ? "0x1" : { transaction_hash: call.params[0].hash },
      });
    },
  });
  try {
    const payloads = Array.from({ length: 2000 }, (_, i) => ({
      hash: normalize(String(i + 1)),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: i,
        method: "starknet_addInvokeTransaction",
        params: [{ hash: normalize(String(i + 1)) }],
      }),
    }));
    const rows = await burst(`http://127.0.0.1:${server.port}`, payloads, 8, () => {});
    expect(rows.length).toBe(2000);
    expect(submitted).toBe(2000);
    expect(rows.every((r) => !r.error)).toBe(true);
    const times = rows.map((r) => BigInt(r.sentNs));
    const spread = Number(times.reduce((a, b) => (a > b ? a : b)) - times.reduce((a, b) => (a < b ? a : b))) / 1e6;
    console.log(JSON.stringify({ localMockReleaseSpreadMs: spread }));
  } finally {
    await server.stop(true);
  }
}, 30000);

test("tier2 signs the real CreateExplorer arguments without a recorded envelope", async () => {
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:38000" });
  provider.getNonceForAddress = async () => "0x2";
  const fixture = {
    chainId: "0x1",
    contract: "0x123",
    accountClassHash: "0x1",
    classHash: "0x1",
    guardianPublicKey: "0x1",
    players: [],
    entrypoint: "create_explorer",
    playerCalldata: [["1", "44", "0", "0", "1000000000000", "0"]],
  };
  const result = await presign(
    fixture,
    { address: "0x456", privateKey: "0x1", publicKey: "0x1", botId: 0 },
    provider,
    1,
    1,
    32,
    256,
  );
  const transaction = JSON.parse(result.body).params[0];
  expect(transaction.calldata.length).toBe(10);
  expect(transaction.calldata.slice(4).map((v: string) => BigInt(v))).toEqual([1n, 44n, 0n, 0n, 1000000000000n, 0n]);
  expect(
    ec.starkCurve.verify(
      new ec.starkCurve.Signature(BigInt(transaction.signature[1]), BigInt(transaction.signature[2])),
      result.hash,
      ec.starkCurve.getPublicKey("0x1", true),
    ),
  ).toBe(true);
});
