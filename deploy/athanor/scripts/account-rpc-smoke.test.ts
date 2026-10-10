import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hash } from "starknet";
import * as accounts from "../../../packages/core/src/account/realms-account";
import { identity } from "../vrf/fixtures";
import { accountRpcSmoke } from "./account-rpc-smoke";
import { startReadRpc } from "./read-rpc";

test("runner probe completes through the public proxy without an operator invoke or private key file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "runner-probe-"));
  const received: string[] = [];
  const node = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const call = await request.json();
      received.push(call.method);
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        ...(call.method === "starknet_estimateFee"
          ? { error: { code: 41, message: "Execution refused" } }
          : {
              result:
                call.method === "starknet_chainId"
                  ? identity.chainId
                  : call.method === "starknet_getClassHashAt"
                    ? identity.accountClassHash
                    : ["0x1"],
            }),
      });
    },
  });
  const proxy = startReadRpc(
    node.url.origin,
    0,
    identity,
    {
      async stamp() {
        throw new Error("unexpected stamp");
      },
    },
    undefined,
    "127.0.0.1",
  );
  const enroll = spyOn(accounts, "joinBotAccount").mockImplementation(async ({ identity: service }) => {
    expect(service).toEqual({ url: "https://identity.test/api", operatorToken: "test-token" });
    return {
      address: "0x42",
      async estimateInvokeFee(call: { entrypoint: string; calldata: string[] }) {
        const response = await fetch(proxy.url, {
          method: "POST",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "starknet_estimateFee",
            params: {
              request: [
                {
                  type: "INVOKE",
                  version: "0x100000000000000000000000000000003",
                  tip: "0x0",
                  sender_address: "0x42",
                  signature: [],
                  calldata: [
                    "0x1",
                    "0x42",
                    hash.getSelectorFromName(call.entrypoint),
                    String(call.calldata.length),
                    ...call.calldata,
                  ],
                },
              ],
              simulation_flags: ["SKIP_VALIDATE"],
              block_id: "pre_confirmed",
            },
          }),
        });
        const answer = await response.json();
        if (answer.error) throw answer.error;
        return answer.result;
      },
    } as never;
  });
  const savedToken = process.env.OPERATOR_TOKEN;
  process.env.OPERATOR_TOKEN = "test-token";
  try {
    await writeFile(join(directory, "harness.env"), "IDENTITY_URL=https://identity.test/api\n");
    await writeFile(join(directory, "native-world.json"), JSON.stringify({ shard: identity }));
    await writeFile(join(directory, "gameplay-contracts.json"), JSON.stringify({ operatorAccountAddress: "0x99" }));
    expect(await accountRpcSmoke(directory, proxy.url.href)).toEqual({
      chainId: identity.chainId,
      deployedBot: "0x42",
      joinShape: "executed-and-refused",
      revokeShape: "executed-and-refused",
    });
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(received.filter((method) => method === "starknet_estimateFee")).toHaveLength(2);
    expect(received).not.toContain("starknet_addInvokeTransaction");
  } finally {
    enroll.mockRestore();
    if (savedToken === undefined) delete process.env.OPERATOR_TOKEN;
    else process.env.OPERATOR_TOKEN = savedToken;
    proxy.stop(true);
    node.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});
