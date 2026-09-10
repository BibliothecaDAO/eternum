import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS, getActiveSubItem, getSectionFromPath, getSubItemHref } from "./navigation-config";

describe("getActiveSubItem", () => {
  it("exposes one lab section for every graphics tool", () => {
    expect(NAVIGATION_SECTIONS.filter((section) => section.basePath.startsWith("/lab"))).toHaveLength(1);
    expect(NAVIGATION_SECTIONS.some((section) => section.id.endsWith("-lab"))).toBe(false);
    for (const path of ["/lab", "/lab/models", "/lab/rewards", "/lab/interface"]) {
      const section = getSectionFromPath(path);
      expect(section.id).toBe("lab");
      const item = getActiveSubItem(section, path, new URLSearchParams());
      expect(getSubItemHref(section, item, new URLSearchParams())).toBe("/lab");
    }
    expect(getSectionFromPath("/laboratory").id).toBe("home");
  });
  it("matches the landing home submenu from pathname instead of the legacy tab query", () => {
    const homeSection = NAVIGATION_SECTIONS.find((section) => section.id === "home");

    expect(homeSection).toBeDefined();
    expect(getActiveSubItem(homeSection!, "/learn", new URLSearchParams())).toEqual(homeSection!.subMenu[1]);
    expect(getActiveSubItem(homeSection!, "/news", new URLSearchParams())).toEqual(homeSection!.subMenu[2]);
    expect(getActiveSubItem(homeSection!, "/factory", new URLSearchParams())).toEqual(homeSection!.subMenu[3]);
  });
});
