// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("usePlayerStructureSync reconnect wiring", () => {
  it("resubscribes player-scoped Torii streams after the connection monitor rebuilds streams", () => {
    const source = readSource("src/hooks/helpers/use-player-structure-sync.ts");

    expect(source).toContain("useConnectionStore");
    expect(source).toContain("streamReconnectVersion");
    expect(source).toContain("subscriptionSetupTimeoutMs: env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS");
  });
});
