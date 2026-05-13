import { multiplyByPrecision } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import { resolveOrderRowResourceInputLimit } from "./market-order-row-balance";

describe("resolveOrderRowResourceInputLimit", () => {
  it("caps sell-order fills by the available display-unit resource balance", () => {
    expect(
      resolveOrderRowResourceInputLimit({
        action: "sell-resource",
        availableResource: 75,
        requestedResourceRaw: multiplyByPrecision(120),
      }),
    ).toBe(75);
  });

  it("caps buy-order fills by the available display-unit lords balance", () => {
    expect(
      resolveOrderRowResourceInputLimit({
        action: "buy-resource",
        availableLords: 250,
        requestedResourceRaw: multiplyByPrecision(100),
        totalLordsRaw: multiplyByPrecision(400),
      }),
    ).toBe(62.5);
  });
});
