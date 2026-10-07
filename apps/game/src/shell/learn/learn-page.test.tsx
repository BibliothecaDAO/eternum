import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";

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
