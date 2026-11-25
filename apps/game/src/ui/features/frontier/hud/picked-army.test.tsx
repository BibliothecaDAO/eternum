// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PickedArmy } from "./picked-army";

it("opens the selected army's details and keeps its refill beside its troops", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onDetails = vi.fn();
  act(() =>
    root.render(
      <PickedArmy
        army={{
          explorerId: 1,
          label: "Army 1",
          number: 1,
          art: "knight-t1",
          troops: 100,
          stamina: { current: 60, max: 150, perExplore: 20 },
          secondsToFull: 0,
          ethereal: undefined,
        }}
        refill={<button>Refill</button>}
        onDetails={onDetails}
      />,
    ),
  );
  try {
    expect(host.querySelector('[aria-label="Troops 100"]')?.querySelector(".ui-chip__icons")).toBeNull();
    expect(host.querySelector(".army-tray__stamina b")?.textContent).toBe("60 / 150");
    expect(host.textContent).toContain("Refill");
    act(() => host.querySelector<HTMLButtonElement>('button[aria-label*="Army 1"]')!.click());
    expect(onDetails).toHaveBeenCalledOnce();
    expect(host.querySelector('[aria-label="Skill points"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
