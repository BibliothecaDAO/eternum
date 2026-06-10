import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { MobileBottomNav } from "./mobile-bottom-nav";

describe("MobileBottomNav", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("preserves shared profile query params when switching profile subtabs", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/profile?player=0xabc&name=Alice"]}>
          <MobileBottomNav />
        </MemoryRouter>,
      );
    });

    const links = Array.from(container.querySelectorAll("a"));
    const profileLink = links.find((link) => link.textContent?.includes("PROFILE"));
    const cosmeticsLink = links.find((link) => link.textContent?.includes("COSMETICS"));
    const walletLink = links.find((link) => link.textContent?.includes("WALLET"));

    expect(profileLink?.getAttribute("href")).toBe("/profile?player=0xabc&name=Alice");
    expect(cosmeticsLink?.getAttribute("href")).toBe("/profile?player=0xabc&name=Alice&tab=cosmetics");
    expect(walletLink?.getAttribute("href")).toBe("/profile?player=0xabc&name=Alice&tab=wallet");
  });
});
