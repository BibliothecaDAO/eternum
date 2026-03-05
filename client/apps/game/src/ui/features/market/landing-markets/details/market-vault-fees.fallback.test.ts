import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("MarketVaultFees fallback source", () => {
  it("loads user fee data by account id when vault share balance is unavailable", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/market/landing-markets/details/market-vault-fees.tsx"),
      "utf8",
    );

    expect(source).toContain("fetchProtocolFeesById");
    expect(source).toContain("const address = providedAddress ?? connectedAddress ?? account?.address");
    expect(source).toContain("if (!hasVaultShares && value === 0n)");
  });
});
