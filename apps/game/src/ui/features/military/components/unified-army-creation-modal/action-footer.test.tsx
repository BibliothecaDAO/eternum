// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/audio", () => ({ useUISound: () => () => {} }));

import { ActionFooter } from "./action-footer";

const footer = (isDisabled: boolean, blockedReason: string | null) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <ActionFooter
      armyType
      label="Create field army"
      isLoading={false}
      isDisabled={isDisabled}
      blockedReason={blockedReason}
      onSubmit={() => {}}
      embedded
    />,
  );
  return host;
};

describe("the order button's reason line", () => {
  it("keeps the same one-line place under the button whether or not there is a reason, so the button never moves", () => {
    const blocked = footer(true, "Choose a troop count.");
    const ready = footer(false, "Choose a troop count.");

    const blockedLine = blocked.querySelector('[role="status"]')!;
    const readyLine = ready.querySelector('[role="status"]')!;
    expect(blockedLine.textContent).toBe("Choose a troop count.");
    expect(readyLine.textContent).toBe("");
    // The same box either way: a fixed one-line height, the same place after the button.
    expect(readyLine.className).toBe(blockedLine.className);
    expect(readyLine.className).toMatch(/\bh-5\b/);
    expect(ready.children.length).toBe(blocked.children.length);
  });
});
