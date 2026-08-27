import { describe, expect, it } from "vitest";

import { flattenModelValue } from "./torii-parity";

describe("flattenModelValue", () => {
  it("normalizes nested model values to Torii's flat scalar representation", () => {
    expect(
      flattenModelValue({
        active: true,
        amount: "0x10",
        coord: { x: "0x2", y: 3 },
        ids: ["0x4", 5],
        status: "Live",
      }),
    ).toEqual({
      active: "1",
      amount: "16",
      "coord.x": "2",
      "coord.y": "3",
      ids: ["4", "5"],
      status: "Live",
    });
  });
});
