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

it.each(["http://localhost:4183", "https://127.0.0.1:3000", "http://[::1]:8080"])(
  "allows loopback %s without CORS_ORIGIN",
  (origin) => {
    expect(isAllowedOrigin(origin, readSecurityConfig({}).allowedOrigins)).toBe(true);
  },
);
it.each([undefined, "null", "https://localhost.attacker.invalid", "ftp://localhost:4183"])(
  "rejects untrusted origin %s",
  (origin) => {
    expect(isAllowedOrigin(origin, readSecurityConfig({}).allowedOrigins)).toBe(false);
  },
);
