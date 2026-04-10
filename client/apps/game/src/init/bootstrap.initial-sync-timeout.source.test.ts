// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("initial sync bootstrap timeout wiring", () => {
  it("passes the configured Torii subscription timeout into the global bootstrap stream", () => {
    const source = readSource("src/dojo/sync.ts");

    expect(source).toContain("subscriptionSetupTimeoutMs:");
    expect(source).toContain("env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS");
  });
});
