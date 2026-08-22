// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS, getActiveSubItem, getSectionFromPath } from "./navigation-config";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("debug navigation entry", () => {
  it("exposes the Three.js chunk debug view from development landing navigation", () => {
    const debugSection = NAVIGATION_SECTIONS.find((section) => section.id === "debug");

    expect(debugSection).toBeDefined();
    expect(debugSection?.basePath).toBe("/debug");
    expect(debugSection?.subMenu).toEqual([
      {
        id: "three-chunks",
        label: "CHUNKS",
        tab: null,
        href: "/debug/three-chunks",
      },
      {
        id: "procedural-characters",
        label: "CHARACTERS",
        tab: null,
        href: "/debug/procedural-characters",
      },
      {
        id: "procedural-character-benchmark",
        label: "BENCHMARK",
        tab: null,
        href: "/debug/procedural-character-benchmark",
      },
    ]);
  });

  it("selects the procedural crowd benchmark by route path", () => {
    const debugSection = getSectionFromPath("/debug/procedural-character-benchmark");

    expect(debugSection.id).toBe("debug");
    expect(getActiveSubItem(debugSection, "/debug/procedural-character-benchmark", new URLSearchParams())).toEqual(
      debugSection.subMenu[2],
    );
  });

  it("selects the procedural character gym by route path", () => {
    const debugSection = getSectionFromPath("/debug/procedural-characters");

    expect(debugSection.id).toBe("debug");
    expect(getActiveSubItem(debugSection, "/debug/procedural-characters", new URLSearchParams())).toEqual(
      debugSection.subMenu[1],
    );
  });

  it("keeps the debug route active without relying on auth or play-route params", () => {
    const debugSection = getSectionFromPath("/debug/three-chunks");

    expect(debugSection.id).toBe("debug");
    expect(getActiveSubItem(debugSection, "/debug/three-chunks", new URLSearchParams())).toEqual(
      debugSection.subMenu[0],
    );
  });

  it("keeps debug navigation guarded by the Vite dev flag", () => {
    const navigationSource = readSource("src/ui/features/landing/context/navigation-config.ts");
    const headerSource = readSource("src/ui/features/landing/components/landing-header.tsx");

    expect(navigationSource).toContain("import.meta.env.DEV");
    expect(headerSource).toContain("import.meta.env.DEV");
    expect(navigationSource).toContain("return [];");
    expect(headerSource).toContain("return [];");
    expect(headerSource).toContain('label: "Debug"');
    expect(headerSource).toContain('path: "/debug/three-chunks"');
  });
});
