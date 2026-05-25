import { describe, expect, it } from "vitest";

import { NAVIGATION_SECTIONS, getActiveSubItem } from "./navigation-config";

describe("getActiveSubItem", () => {
  it("matches the landing home submenu from pathname instead of the legacy tab query", () => {
    const homeSection = NAVIGATION_SECTIONS.find((section) => section.id === "home");

    expect(homeSection).toBeDefined();
    expect(getActiveSubItem(homeSection!, "/learn", new URLSearchParams())).toEqual(homeSection!.subMenu[1]);
    expect(getActiveSubItem(homeSection!, "/news", new URLSearchParams())).toEqual(homeSection!.subMenu[2]);
    expect(getActiveSubItem(homeSection!, "/factory", new URLSearchParams())).toEqual(homeSection!.subMenu[3]);
  });

  it("continues to use the tab query for non-home sections", () => {
    const profileSection = NAVIGATION_SECTIONS.find((section) => section.id === "profile");

    expect(profileSection).toBeDefined();
    expect(getActiveSubItem(profileSection!, "/profile", new URLSearchParams("tab=wallet"))).toEqual(
      profileSection!.subMenu[2],
    );
  });
});
