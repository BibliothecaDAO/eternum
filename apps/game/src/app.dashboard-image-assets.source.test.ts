// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Dashboard image assets", () => {
  it("uses optimized cell-shaded landing backgrounds instead of missing blitz cover paths", () => {
    const dynamicBackgroundSource = readSource("src/ui/features/landing/components/background/dynamic-background.tsx");
    const landingLayoutSource = readSource("src/ui/features/landing/landing-layout.tsx");
    const playViewSource = readSource("src/ui/features/landing/views/play-view.tsx");
    const seasonPlacementMapSource = readSource("src/ui/features/landing/components/season-placement-map.tsx");

    expect(dynamicBackgroundSource).toContain("/images/covers/dashboard/");
    expect(dynamicBackgroundSource).toContain("/images/covers/blitz/");
    expect(dynamicBackgroundSource).not.toContain("/images/covers/${");
    expect(dynamicBackgroundSource).not.toContain('new Set(["01", "02", "04", "05", "07"])');
    expect(landingLayoutSource).not.toContain('"/factory": "03"');
    expect(landingLayoutSource).not.toContain('"/news": "01"');
    expect(playViewSource).toContain("/images/covers/dashboard/07.webp");
    expect(playViewSource).toContain("/images/covers/dashboard/02.webp");
    expect(seasonPlacementMapSource).toContain("/images/covers/dashboard/07.webp");
    expect(seasonPlacementMapSource).not.toContain("/images/covers/blitz/");

    for (const backgroundId of ["02", "07"]) {
      expect(existsSync(resolve(process.cwd(), `public/images/covers/dashboard/${backgroundId}.webp`))).toBe(true);
      expect(existsSync(resolve(process.cwd(), `public/images/covers/blitz/${backgroundId}.png`))).toBe(true);
    }
  });
});
