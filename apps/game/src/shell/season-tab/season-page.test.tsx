import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

// Blitz's board has its own test; this page test reads Frontier's board and the switch.
vi.mock("./blitz-board", () => ({ BlitzBoard: () => <p>Blitz board</p> }));
vi.mock("../herald", () => ({
  useDirectory: () => ({ data: undefined, isError: true, isPending: false, error: new Error("502"), refetch: vi.fn() }),
  useLeaderboard: () => ({ data: undefined, isError: false, isPending: true }),
  useRealmsPlayer: () => ({ data: null }),
}));
vi.spyOn(console, "error").mockImplementation(() => undefined);

import { setViewportWidth } from "../frame/test-viewport";
import { SeasonPage } from "./season-page";

it("says Season did not answer in the glossary's words, with Try again, and the switch still works", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setViewportWidth(390);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter>
        <SeasonPage />
      </MemoryRouter>,
    ),
  );
  try {
    const body = container.querySelector('[data-band="body"]')!;
    expect(body.textContent).toContain("Season did not answer.");
    expect(body.textContent).not.toContain("502");
    const blitz = [...body.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === "Blitz")!;
    await act(async () => (blitz as HTMLButtonElement).click());
    expect(blitz.getAttribute("aria-selected")).toBe("true");
    expect(body.textContent).toContain("Blitz board");
    expect(body.textContent).not.toContain("Season did not answer.");
  } finally {
    await act(async () => root.unmount());
  }
});
