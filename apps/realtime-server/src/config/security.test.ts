import { describe, expect, it } from "vitest";

import { isAllowedOrigin, readSecurityConfig } from "./security";

describe("browser origin policy", () => {
  it("is closed by default and exact-match allowlisted", () => {
    expect(isAllowedOrigin("https://play.realms.test", readSecurityConfig({}).allowedOrigins)).toBe(false);
    const allowed = readSecurityConfig({ CORS_ORIGIN: "https://play.realms.test" }).allowedOrigins;
    expect(isAllowedOrigin("https://play.realms.test", allowed)).toBe(true);
    expect(isAllowedOrigin("https://evil.realms.test", allowed)).toBe(false);
  });
});
