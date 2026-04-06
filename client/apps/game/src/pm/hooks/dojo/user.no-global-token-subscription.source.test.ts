import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("UserProvider token loading", () => {
  it("does not subscribe to all token balances on provider mount", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pm/hooks/dojo/user.tsx"), "utf8");

    expect(source).not.toContain("contractAddresses: [],");
    expect(source).not.toContain("useTokens({");
  });
});
