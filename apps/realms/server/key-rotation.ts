import { Account, RpcProvider, WebSocketChannel, num, stark, type Call } from "starknet";

/** Wait for this player's pending gameplay before submitting the signed rotation. */
export async function submitOrderedKeyRotation(
  authority: Account,
  provider: RpcProvider,
  call: Call,
  admissionUrl: string,
) {
  const estimate = await authority.estimateInvokeFee(call, { tip: 0 });
  const [invocation] = await authority.accountInvocationsFactory([{ type: "INVOKE", payload: call }], {
    versions: ["0x3"],
    resourceBounds: estimate.resourceBounds,
    tip: 0,
    skipValidate: false,
  });
  const transaction = {
    type: "INVOKE",
    version: "0x3",
    sender_address: invocation.contractAddress,
    calldata: encodeCalldata(invocation.calldata),
    signature: stark.signatureToHexArray(invocation.signature),
    nonce: num.toHex(invocation.nonce),
    resource_bounds: stark.resourceBoundsToHexString(estimate.resourceBounds),
    tip: "0x0",
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  const url = new URL(admissionUrl);
  url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
  const channel = new WebSocketChannel({ nodeUrl: url.toString(), autoReconnect: false, requestTimeout: 120_000 });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Ordered key rotation connection timed out")), 10_000);
      channel.on("open", () => {
        clearTimeout(timeout);
        resolve();
      });
      channel.on("error", () => {
        clearTimeout(timeout);
        reject(new Error("Ordered key rotation connection failed"));
      });
    });
    const hash: unknown = await channel.sendReceive("game_rotateGameplayKey", [transaction]);
    if (typeof hash !== "string" || !/^0x[0-9a-f]+$/i.test(hash)) throw new Error("Malformed key rotation receipt");
    await provider.waitForTransaction(hash);
    return hash;
  } finally {
    channel.disconnect();
  }
}

function encodeCalldata(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Missing signed rotation calldata");
  return value.map((felt: unknown) => {
    if (typeof felt !== "string") throw new Error("Malformed signed rotation calldata");
    return num.toHex(felt);
  });
}
