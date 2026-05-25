// @vitest-environment node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("Market watch entry routing", () => {
  it("uses the market chain rather than the startup env chain when opening canonical spectate routes", () => {
    const hookSource = readFileSync(fileURLToPath(new URL("./use-market-watch.ts", import.meta.url)), "utf8");
    const modalSource = readFileSync(
      fileURLToPath(new URL("../../landing/views/market-details-modal.tsx", import.meta.url)),
      "utf8",
    );

    expect(hookSource).toContain("export const useMarketWatch = (chain: Chain) => {");
    expect(hookSource).toContain("buildEntryHref({");
    expect(hookSource).not.toContain("const chain = env.VITE_PUBLIC_CHAIN as Chain;");
    expect(modalSource).toContain("useMarketWatch(chain)");
  });
});
