// @vitest-environment node

import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS, getActiveSubItem, getSectionFromPath } from "./navigation-config";

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
      {
        id: "world-fx",
        label: "FX",
        tab: null,
        href: "/debug/world-fx",
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

  it("selects the procedural FX gym by route path", () => {
    const debugSection = getSectionFromPath("/debug/world-fx");

    expect(debugSection.id).toBe("debug");
    expect(getActiveSubItem(debugSection, "/debug/world-fx", new URLSearchParams())).toEqual(debugSection.subMenu[3]);
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
});
