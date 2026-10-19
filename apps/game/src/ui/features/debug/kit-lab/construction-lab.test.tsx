// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-compact-hud", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCompactLane: () => "portrait",
}));

import { ConstructionLab } from "./construction-lab";

it("keeps a phone card's management under Details once it opens, with the building's numbers beside it", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<ConstructionLab />));
  const farm = () => host.querySelector('section[aria-label="Farm"]');
  const details = farm()!.querySelector("details")!;
  act(() => {
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
  });
  expect(farm()).not.toBeNull();
  expect([...farm()!.querySelectorAll("details button")].map((button) => button.textContent)).toEqual([
    "Pause all",
    "Destroy one",
  ]);
  expect(farm()!.querySelector('[aria-label="Build cost"]')?.textContent).toContain("Wood");
  act(() => root.unmount());
  host.remove();
});
