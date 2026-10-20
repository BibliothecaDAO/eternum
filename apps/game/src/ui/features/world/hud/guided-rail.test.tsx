// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { RailFrame } from "./guided-rail";

const rail = (chatOpen: boolean) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <RailFrame chat={<button aria-label="Chat strip" />} chatOpen={chatOpen}>
      <section aria-label="Events" />
    </RailFrame>,
  );
  const aside = host.querySelector('aside[aria-label="Guided rail"]')!;
  return {
    panels: aside.children[0]!,
    foot: aside.children[1]!,
    strip: aside.querySelector('[aria-label="Chat strip"]')!,
  };
};

it("stands chat at the rail's foot, outside the panels' scroll, so no height scrolls the strip away", () => {
  const { panels, foot, strip } = rail(true);
  expect(panels.classList.contains("overflow-y-auto")).toBe(true);
  expect(panels.contains(panels.querySelector('[aria-label="Events"]'))).toBe(true);
  expect(panels.contains(strip)).toBe(false);
  expect(foot.contains(strip)).toBe(true);
});

it("floors an open chat at its least height in the rail, and a closed one at its strip", () => {
  expect(rail(true).foot.classList.contains("min-h-hud-chat-least")).toBe(true);
  expect(rail(false).foot.classList.contains("min-h-hud-chat-least")).toBe(false);
});
