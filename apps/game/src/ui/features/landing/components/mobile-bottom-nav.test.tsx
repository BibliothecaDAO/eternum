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

  it("shows only game landing destinations", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/"]}>
          <MobileBottomNav />
        </MemoryRouter>,
      );
    });

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/learn", "/news", "/factory"]);
  });
});
