// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("SecondaryMenuItems network switch placement", () => {
  it("does not mount the shared game network switch in the in-world top-right menu", () => {
    const source = readSource("src/ui/features/world/containers/secondary-menu-items.tsx");

    expect(source).not.toContain('import { GameNetworkSwitchButton } from "@/ui/shared/components/game-network-switch-button"');
    expect(source).not.toContain("<GameNetworkSwitchButton");
  });
});
