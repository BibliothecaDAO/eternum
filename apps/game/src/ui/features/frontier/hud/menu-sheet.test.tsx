import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MenuSheet } from "./menu-sheet";

it("opens Today and Settings from their own semantic glyphs, and has no Guide or Production row", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onToday = vi.fn(),
    onSettings = vi.fn();
  try {
    await act(async () =>
      root.render(
        <MenuSheet
          rank="#12"
          onToday={onToday}
          onSeason={() => {}}
          onSettings={onSettings}
          onExit={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    for (const [label, name, callback] of [
      ["Today", "clock", onToday],
      ["Settings", "settings", onSettings],
    ] as const) {
      const button = [...host.querySelectorAll<HTMLButtonElement>("nav button")].find((b) =>
        b.textContent?.includes(label),
      )!;
      expect(button).toBeTruthy();
      expect(button.closest(".ui-row")?.querySelector("img")?.getAttribute("src")).toBe(
        `/icons/facets/64/${name}.webp`,
      );
      await act(async () => button.click());
      expect(callback).toHaveBeenCalledTimes(1);
    }
    for (const gone of ["Guide", "Production"])
      expect([...host.querySelectorAll("nav button")].some((button) => button.textContent?.includes(gone))).toBe(false);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
