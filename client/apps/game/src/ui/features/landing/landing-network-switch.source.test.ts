// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing network switch wiring", () => {
  it("mounts the shared game network switch in the dashboard header controls", () => {
    const layoutSource = readSource("src/ui/features/landing/landing-layout.tsx");

    expect(layoutSource).toContain('import { GameNetworkSwitchButton } from "@/ui/shared/components/game-network-switch-button"');
    expect(layoutSource).toContain("<LandingHeader");
    expect(layoutSource).toContain("walletButton={");
    expect(layoutSource).toContain('<GameNetworkSwitchButton className="hidden md:flex" />');
    expect(layoutSource).toContain("<Controller />");
  });
});
