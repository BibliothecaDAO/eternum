// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing network state adoption", () => {
  it("uses the landing chain filter without imposing wallet network switching on factory submissions", () => {
    const gameGridSource = readSource("src/ui/features/landing/components/game-selector/game-card-grid.tsx");
    const factorySource = readSource("src/ui/features/factory-v2/hooks/use-factory-v2-developer-config.ts");

    expect(gameGridSource).toContain('import { useLandingNetworkState } from "../../hooks/use-landing-network-state";');
    expect(factorySource).toContain('import { useAccountStore } from "@/hooks/store/use-account-store";');
    expect(factorySource).not.toContain("useLandingNetworkState");
    expect(factorySource).not.toContain("SwitchNetworkPrompt");
  });
});
