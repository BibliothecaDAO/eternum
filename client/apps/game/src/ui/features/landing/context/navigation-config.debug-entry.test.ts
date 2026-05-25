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
    expect(debugSection?.basePath).toBe("/debug/three-chunks");
    expect(debugSection?.subMenu).toEqual([
      {
        id: "three-chunks",
        label: "DEBUG",
        tab: null,
        href: "/debug/three-chunks",
      },
    ]);
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
