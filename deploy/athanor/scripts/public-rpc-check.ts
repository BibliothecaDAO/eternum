import { hash } from "starknet";
const WRITE_METHODS = [
  "starknet_addInvokeTransaction",
  "starknet_addDeployAccountTransaction",
  "starknet_addDeclareTransaction",
];

export async function assertPublicRpcBoundary(
  url: string,
  identity?: { accountClassHash: string; guardianPublicKey: string; operator: string },
) {
  async function request(payload: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}; expected an explicit RPC method rejection`);
    return response.json() as Promise<{ result?: string; error?: { code: number } }>;
  }
  const call = (method: string) => ({ jsonrpc: "2.0", id: 1, method, params: [] });
  const read = await request(call("starknet_chainId"));
  if (!read.result) throw new Error(`${url}: chain identity read failed`);
  for (const method of WRITE_METHODS) {
    // Invalid params from the node means the write handler is reachable, not that writes are blocked.
    for (const payload of [call(method), [call("starknet_chainId"), call(method)]]) {
      const result = await request(payload);
      if (result.error?.code !== -32601)
        throw new Error(`${url}: ${method} is not blocked before parameter validation`);
    }
  }
  const refusedShapes: string[] = [];
  if (identity) {
    const deploy = {
      type: "DEPLOY_ACCOUNT",
      version: "0x3",
      tip: "0x0",
      class_hash: identity.accountClassHash,
      constructor_calldata: ["0x42", identity.guardianPublicKey],
      contract_address_salt: "0x42",
      signature: ["0x1", "0x2", "0x3", "0x4", "0x5"],
    };
    const invoke = {
      type: "INVOKE",
      version: "0x3",
      tip: "0x0",
      sender_address: identity.operator,
      calldata: ["0x1", identity.operator, hash.starknetKeccak("is_device").toString(), "0x1", "0x1"],
      signature: deploy.signature,
    };
    const cases = [
      [
        "foreign-class deploy",
        "starknet_addDeployAccountTransaction",
        { ...deploy, class_hash: `0x${(BigInt(identity.accountClassHash) + 1n).toString(16)}` },
      ],
      [
        "foreign guardian deploy",
        "starknet_addDeployAccountTransaction",
        { ...deploy, constructor_calldata: ["0x42", `0x${(BigInt(identity.guardianPublicKey) + 1n).toString(16)}`] },
      ],
      [
        "other contract",
        "starknet_addInvokeTransaction",
        { ...invoke, calldata: ["0x1", "0x2", ...invoke.calldata.slice(2)] },
      ],
      [
        "other selector",
        "starknet_addInvokeTransaction",
        { ...invoke, calldata: ["0x1", identity.operator, "0x2", "0x1", "0x1"] },
      ],
      [
        "multi-call",
        "starknet_addInvokeTransaction",
        { ...invoke, calldata: ["0x2", ...invoke.calldata.slice(1), ...invoke.calldata.slice(1)] },
      ],
    ] as const;
    for (const [name, method, transaction] of cases) {
      const result = await request({ ...call(method), params: [transaction] });
      if (result.error?.code !== -32601) throw new Error(`${url}: ${name} is not refused`);
      refusedShapes.push(name);
    }
  }
  const response = await fetch(url, {
    headers: {
      Connection: "Upgrade",
      Upgrade: "websocket",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (response.status !== 403) throw new Error(`${url}: node WebSocket bypass is not blocked`);
  return {
    url,
    chainId: read.result,
    rejected: WRITE_METHODS,
    mixedBatchesRejected: true,
    websocketRejected: true,
    refusedShapes,
  };
}
