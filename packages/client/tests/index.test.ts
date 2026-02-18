import { describe, expect, it } from "vitest";
import * as barrel from "../src/index";
import { EternumClient } from "../src/client";
import { ViewClient } from "../src/views";
import { ViewCache } from "../src/cache";

describe("client barrel exports", () => {
  it("re-exports core runtime modules", () => {
    expect(barrel.EternumClient).toBe(EternumClient);
    expect(barrel.ViewClient).toBe(ViewClient);
    expect(barrel.ViewCache).toBe(ViewCache);
    expect(typeof barrel.TransactionClient).toBe("function");
  });

  it("re-exports compute helpers", () => {
    expect(typeof barrel.computeStrength).toBe("function");
    expect(typeof barrel.computeOutputAmount).toBe("function");
    expect(typeof barrel.computeBuildingCost).toBe("function");
  });
});
