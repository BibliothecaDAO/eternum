import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS, getActiveSubItem, getSectionFromPath, getSubItemHref } from "./navigation-config";

describe("getActiveSubItem", () => {
  it.each(["biome-lab", "local-lab", "model-lab"])("exposes %s as a first-class lab", (id) => {
    const section = getSectionFromPath(`/${id}`);
    expect(section.id).toBe(id);
    const item = getActiveSubItem(section, `/${id}`, new URLSearchParams());
    expect(getSubItemHref(section, item, new URLSearchParams())).toBe(`/${id}`);
  });
  it("matches the landing home submenu from pathname instead of the legacy tab query", () => {
    const homeSection = NAVIGATION_SECTIONS.find((section) => section.id === "home");

    expect(homeSection).toBeDefined();
    expect(getActiveSubItem(homeSection!, "/learn", new URLSearchParams())).toEqual(homeSection!.subMenu[1]);
    expect(getActiveSubItem(homeSection!, "/news", new URLSearchParams())).toEqual(homeSection!.subMenu[2]);
    expect(getActiveSubItem(homeSection!, "/factory", new URLSearchParams())).toEqual(homeSection!.subMenu[3]);
  });
});
