import { afterEach, describe, expect, it, vi } from "vitest";
import { Account, RpcProvider, ec, hash, constants, stark } from "starknet";
import { submitOrderedKeyRotation } from "./key-rotation";

const bounds = {
  l1_gas: { max_amount: 100n, max_price_per_unit: 10n },
  l2_gas: { max_amount: 1_000_000n, max_price_per_unit: 20n },
  l1_data_gas: { max_amount: 200n, max_price_per_unit: 30n },
};
const chain = constants.StarknetChainId.SN_SEPOLIA;
const secret = "0x123";
const call = { contractAddress: "0x7", entrypoint: "rotate_public_key", calldata: ["0x456"] };

function setup() {
  const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:1" });
  const authority = new Account({ provider, address: "0x5", signer: secret, cairoVersion: "1" });
  vi.spyOn(authority, "getChainId").mockResolvedValue(chain);
  vi.spyOn(authority, "getNonce").mockResolvedValue("0x9");
  vi.spyOn(authority, "estimateInvokeFee").mockResolvedValue({ resourceBounds: bounds } as never);
  vi.spyOn(provider, "waitForTransaction").mockResolvedValue({} as never);
  const direct = vi.spyOn(authority, "execute");
  return { authority, provider, direct };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ordered gameplay key rotation", () => {
  it("signs one authority transaction and waits for the admission service to execute it", async () => {
    const { authority, provider, direct } = setup();
    let release!: (value: Response) => void;
    const request = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", request);
    const rotation = submitOrderedKeyRotation(authority, provider, call, "http://127.0.0.1:15181");
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(provider.waitForTransaction).not.toHaveBeenCalled();
    expect(direct).not.toHaveBeenCalled();
    const [url, options] = request.mock.calls[0]!;
    expect(url.toString()).toBe("http://127.0.0.1:15181/key-rotations");
    const transaction = JSON.parse(options.body);
    expect(transaction.calldata.every((felt: string) => /^0x[0-9a-f]+$/i.test(felt))).toBe(true);
    expect(transaction.calldata.map(BigInt)).toEqual([
      1n,
      7n,
      BigInt(hash.getSelectorFromName("rotate_public_key")),
      1n,
      0x456n,
    ]);
    expect(transaction.nonce).toBe("0x9");
    const identity = hash.calculateInvokeTransactionHash({
      senderAddress: transaction.sender_address,
      version: "0x3",
      compiledCalldata: transaction.calldata,
      chainId: chain,
      nonce: transaction.nonce,
      accountDeploymentData: [],
      nonceDataAvailabilityMode: 0,
      feeDataAvailabilityMode: 0,
      resourceBounds: stark.resourceBoundsToBigInt(transaction.resource_bounds),
      tip: 0,
      paymasterData: [],
    });
    const signature = new ec.starkCurve.Signature(BigInt(transaction.signature[0]), BigInt(transaction.signature[1]));
    expect(ec.starkCurve.verify(signature, identity, ec.starkCurve.getPublicKey(secret))).toBe(true);
    release(Response.json("0x77"));
    await expect(rotation).resolves.toBe("0x77");
    expect(provider.waitForTransaction).toHaveBeenCalledWith("0x77");
  });

  it.each([400, 503])("fails loudly on admission refusal %s without direct submission", async (status) => {
    const { authority, provider, direct } = setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(submitOrderedKeyRotation(authority, provider, call, "http://127.0.0.1:15181")).rejects.toThrow(
      `Ordered key rotation failed (${status})`,
    );
    expect(direct).not.toHaveBeenCalled();
    expect(provider.waitForTransaction).not.toHaveBeenCalled();
  });
});
