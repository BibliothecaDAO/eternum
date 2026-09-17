import { Account, RpcProvider, num, stark, type Call } from "starknet";

/** Submit the authority-signed rotation through the same queue as accepted gameplay. */
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
  const response = await fetch(new URL("key-rotations", `${admissionUrl.replace(/\/$/, "")}/`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(transaction),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Ordered key rotation failed (${response.status})`);
  const hash: unknown = await response.json();
  if (typeof hash !== "string" || !/^0x[0-9a-f]+$/i.test(hash)) throw new Error("Malformed key rotation receipt");
  await provider.waitForTransaction(hash);
  return hash;
}

function encodeCalldata(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("Missing signed rotation calldata");
  return value.map((felt: unknown) => {
    if (typeof felt !== "string") throw new Error("Malformed signed rotation calldata");
    return num.toHex(felt);
  });
}
