// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("DashboardNetworkSwitch source", () => {
  it("shows Mainnet before Slot in the landing chain selector", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/ui/features/landing/components/dashboard-network-switch.tsx"),
      "utf8",
    );

    expect(source).toContain('const DASHBOARD_CHAIN_OPTIONS: LandingNetworkChain[] = ["mainnet", "slot"];');
  });
});
