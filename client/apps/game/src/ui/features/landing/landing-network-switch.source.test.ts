// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing network switch wiring", () => {
  it("mounts the compact dashboard network switch in the header controls", () => {
    const layoutSource = readSource("src/ui/features/landing/landing-layout.tsx");

    expect(layoutSource).toContain('import { DashboardNetworkSwitch } from "./components/dashboard-network-switch"');
    expect(layoutSource).toContain("<LandingHeader");
    expect(layoutSource).toContain("walletButton={");
    expect(layoutSource).toContain('<DashboardNetworkSwitch className="hidden md:flex" />');
    expect(layoutSource).toContain("<Controller />");
  });
});
