// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing network state adoption", () => {
  it("routes landing consumers through the shared landing network hook", () => {
    const gameGridSource = readSource("src/ui/features/landing/components/game-selector/game-card-grid.tsx");
    const profileSource = readSource("src/ui/features/landing/components/player-profile.tsx");
    const factorySource = readSource("src/ui/features/factory-v2/hooks/use-factory-v2-developer-config.ts");

    expect(gameGridSource).toContain('import { useLandingNetworkState } from "../../hooks/use-landing-network-state";');
    expect(profileSource).toContain(
      'import { useLandingNetworkState } from "@/ui/features/landing/hooks/use-landing-network-state";',
    );
    expect(factorySource).toContain(
      'import { useLandingNetworkState } from "@/ui/features/landing/hooks/use-landing-network-state";',
    );
  });
});
