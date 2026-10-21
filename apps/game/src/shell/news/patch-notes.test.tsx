import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";

import type { PatchChange } from "./patch-note";
import { PatchChanges } from "./patch-notes";

let unmount: (() => Promise<void>) | null = null;
afterEach(async () => {
  await unmount?.();
  unmount = null;
});

const render = async (changes: readonly PatchChange[]) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(<PatchChanges changes={changes} />));
  unmount = () => act(async () => root.unmount());
  return container;
};

it("groups a mode's changes New, Balance, Fixes, each read whole with a moved number's old and new", async () => {
  const page = await render([
    { kind: "fix", icon: "move", title: "Selection holds", line: "Your army stays selected." },
    {
      kind: "balance",
      icon: "wheat",
      title: "Wheat on the march",
      line: "Moving costs wheat.",
      from: "0.03",
      to: "0.05",
    },
    { kind: "new", icon: "realm", title: "Frontier opens", line: "A new land every day." },
  ]);
  const groups = [...page.querySelectorAll("section")].map((group) => ({
    kind: group.getAttribute("aria-label"),
    rows: [...group.querySelectorAll(".app-row")].map((row) => [
      row.querySelector(".app-row__title")?.textContent,
      row.querySelector(".app-row__detail")?.textContent,
      row.querySelector(".app-row__trail")?.textContent ?? null,
    ]),
  }));
  expect(groups).toEqual([
    { kind: "New", rows: [["Frontier opens", "A new land every day.", null]] },
    { kind: "Balance", rows: [["Wheat on the march", "Moving costs wheat.", "0.030.05"]] },
    { kind: "Fixes", rows: [["Selection holds", "Your army stays selected.", null]] },
  ]);
  expect(page.querySelector(".app-row__trail s")?.textContent).toBe("0.03");
});
