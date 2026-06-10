// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createConnectionDeadEndRecoveryGate } from "./connection-dead-end-recovery-gate";

describe("createConnectionDeadEndRecoveryGate", () => {
  it("allows recovery once for the same Torii URL and reason", () => {
    const shouldRunRecovery = createConnectionDeadEndRecoveryGate();

    const input = {
      toriiBaseUrl: "https://api.example.test/x/world/torii",
      reason: "endpoint_not_found",
    };

    expect(shouldRunRecovery(input)).toBe(true);
    expect(shouldRunRecovery(input)).toBe(false);
  });

  it("allows recovery independently by Torii URL and reason", () => {
    const shouldRunRecovery = createConnectionDeadEndRecoveryGate();

    expect(
      shouldRunRecovery({
        toriiBaseUrl: "https://api.example.test/x/world-a/torii",
        reason: "endpoint_not_found",
      }),
    ).toBe(true);
    expect(
      shouldRunRecovery({
        toriiBaseUrl: "https://api.example.test/x/world-b/torii",
        reason: "endpoint_not_found",
      }),
    ).toBe(true);
    expect(
      shouldRunRecovery({
        toriiBaseUrl: "https://api.example.test/x/world-a/torii",
        reason: "server_error",
      }),
    ).toBe(true);
  });
});
