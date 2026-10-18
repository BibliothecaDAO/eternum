// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { SeasonOverCard } from "./season-over-card";
it("season end keeps Exit and Season on the single HUD control path", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const exit = vi.fn();
  const season = vi.fn();
  try {
    act(() =>
      root.render(
        <SeasonOverCard
          ending="strong"
          place={12}
          field={1000}
          podium={[]}
          totals={undefined}
          onExit={exit}
          onSeason={season}
        />,
      ),
    );
    const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>("button"));
    act(() => buttons.find((b) => b.textContent === "Exit")!.click());
    act(() => buttons.find((b) => b.textContent === "Season")!.click());
    expect(exit).toHaveBeenCalledTimes(1);
    expect(season).toHaveBeenCalledTimes(1);
    expect(buttons.filter((b) => !b.classList.contains("ui-button")).map((b) => b.textContent)).toEqual([]);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
