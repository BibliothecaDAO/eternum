import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";

import { setViewportWidth } from "../frame/test-viewport";
import { ScrollPage } from "../play/play-page";
import { LearnPage } from "./learn-page";

it("lists a guide per mode, the players' guides, then News newest first, with the legal pages at the foot", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <LearnPage />
      </MemoryRouter>,
    ),
  );
  try {
    const body = () => container.querySelector('[data-band="body"]')!;
    expect([...body().querySelectorAll("button span.font-ui")].map((name) => name.textContent)).toEqual([
      "How Frontier plays",
      "How Blitz plays",
      "How Eternum plays",
      "Guides by players",
    ]);
    const foot = container.querySelector('[data-band="foot"]')!;
    expect([...foot.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["/terms", "/privacy"]);
    const news = [...body().querySelectorAll('[role="radio"]')].find((radio) => radio.textContent === "News")!;
    await act(async () => (news as HTMLButtonElement).click());
    expect(body().querySelectorAll("button").length).toBeGreaterThan(0);
  } finally {
    await act(async () => root.unmount());
  }
});

it("opens on News when a phone follows the Scroll's address", async () => {
  setViewportWidth(390);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/scroll"]}>
        <Routes>
          <Route path="/scroll" element={<ScrollPage />} />
          <Route path="/learn" element={<LearnPage />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  try {
    const lit = container.querySelector('[role="radio"][aria-checked="true"]');
    expect(lit?.textContent).toBe("News");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});
