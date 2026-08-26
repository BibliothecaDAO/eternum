// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Blitz hyperstructure creation account boundary", () => {
  it("submits with the provisioned gameplay account", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-blitz-hyperstructure-creation.ts"), "utf8");

    expect(source).toContain("useAccountStore((state) => state.account)");
    expect(source).not.toContain("@starknet-react/core");
    expect(source).not.toContain("useAccount()");
  });
});
