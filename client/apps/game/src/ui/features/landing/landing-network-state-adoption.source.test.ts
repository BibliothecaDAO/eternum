// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing network state adoption", () => {
  it("routes landing consumers through the shared landing network hook", () => {
    const dashboardSource = readSource("src/ui/features/landing/components/dashboard-network-switch.tsx");
    const gameGridSource = readSource("src/ui/features/landing/components/game-selector/game-card-grid.tsx");
    const marketsSource = readSource("src/ui/features/landing/views/markets-view.tsx");
    const factorySource = readSource("src/ui/features/factory-v2/hooks/use-factory-v2-developer-config.ts");

    expect(dashboardSource).toContain('import { useLandingNetworkState } from "../hooks/use-landing-network-state";');
    expect(gameGridSource).toContain('import { useLandingNetworkState } from "../../hooks/use-landing-network-state";');
    expect(marketsSource).toContain('import { useLandingNetworkState } from "../hooks/use-landing-network-state";');
    expect(factorySource).toContain(
      'import { useLandingNetworkState } from "@/ui/features/landing/hooks/use-landing-network-state";',
    );
  });
});
