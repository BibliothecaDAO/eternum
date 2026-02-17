import { describe, expect, it } from "vitest";
import { getActiveOrderLookupAddress } from "./token-detail-modal.utils";

describe("getActiveOrderLookupAddress", () => {
  it("uses token contract address for order lookup", () => {
    const address = getActiveOrderLookupAddress({
      contract_address: "0x1234",
    });
    expect(address).toBe("0x1234");
  });
});
