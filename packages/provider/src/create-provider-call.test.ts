import { describe, expect, it, vi } from "vitest";
import { EternumProvider } from "./index";

describe("EternumProvider.createProviderCall", () => {
  it("returns a structured queue payload with signer, details and execute", async () => {
    const provider = Object.create(EternumProvider.prototype) as any;
    provider.executeAndCheckTransaction = vi.fn().mockResolvedValue({ statusReceipt: "OK" });

    const signer = { address: "0x123" };
    const transactionDetails = {
      contractAddress: "0x456",
      entrypoint: "set_entity_name",
      calldata: ["1", "name"],
    };

    const queuePayload = provider.createProviderCall(signer, transactionDetails);

    expect(queuePayload).toMatchObject({ signer, transactionDetails });
    expect(typeof queuePayload.execute).toBe("function");

    await queuePayload.execute();

    expect(provider.executeAndCheckTransaction).toHaveBeenCalledWith(signer, transactionDetails);
  });

  it("does not depend on legacy function metadata fields", () => {
    const provider = Object.create(EternumProvider.prototype) as any;
    provider.executeAndCheckTransaction = vi.fn().mockResolvedValue({ statusReceipt: "OK" });

    const queuePayload = provider.createProviderCall(
      { address: "0xabc" },
      {
        contractAddress: "0xdef",
        entrypoint: "set_address_name",
        calldata: ["name"],
      },
    );

    expect((queuePayload as any)._signer).toBeUndefined();
    expect((queuePayload as any)._transactionDetails).toBeUndefined();
  });
});
