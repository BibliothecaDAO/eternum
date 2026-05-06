import { describe, expect, it } from "vitest";

import { isMockTransferRoutesEnabled } from "./mock-transfer-routes-overlay";

describe("isMockTransferRoutesEnabled", () => {
  it("defaults to disabled", () => {
    expect(isMockTransferRoutesEnabled("")).toBe(false);
    expect(isMockTransferRoutesEnabled("?foo=bar")).toBe(false);
  });

  it("enables mock mode for explicit mock values", () => {
    expect(isMockTransferRoutesEnabled("?debugTransferRoutes=mock")).toBe(true);
    expect(isMockTransferRoutesEnabled("?debugTransferRoutes=1")).toBe(true);
  });

  it("disables mock mode for falsey values", () => {
    expect(isMockTransferRoutesEnabled("?debugTransferRoutes=0")).toBe(false);
    expect(isMockTransferRoutesEnabled("?debugTransferRoutes=false")).toBe(false);
  });
});
