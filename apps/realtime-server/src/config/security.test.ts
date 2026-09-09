import { describe, expect, it } from "vitest";

import { isAllowedOrigin, readSecurityConfig, resolveAllowedOrigin } from "./security";

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

it("echoes allowed and loopback origins for CORS and refuses the rest", () => {
  const allowed = readSecurityConfig({ CORS_ORIGIN: "https://play.realms.test" }).allowedOrigins;
  expect(resolveAllowedOrigin("https://play.realms.test", allowed)).toBe("https://play.realms.test");
  expect(resolveAllowedOrigin("https://localhost:4183", allowed)).toBe("https://localhost:4183");
  expect(resolveAllowedOrigin("https://evil.realms.test", allowed)).toBeNull();
  expect(resolveAllowedOrigin(undefined, allowed)).toBeNull();
});
