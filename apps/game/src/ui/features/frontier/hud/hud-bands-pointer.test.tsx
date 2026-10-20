import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { CANCEL } from "@/ui/design-system/kit/words";
import { HudBands } from "./hud-bands";

let host: HTMLDivElement;
let root: Root;
let sheet: HTMLStyleElement;

/**
 * The HUD's own style sheet as the game loads it, with the one Tailwind utility the bands are drawn with: the bands let
 * the pointer through to the map. Its build-time theme() values are not what this reads, and the test DOM cannot parse
 * them.
 */
const hudSheet = () =>
  readFileSync(join(__dirname, "../../../design-system/kit/hud-sheet.css"), "utf8")
    .replace(/theme\([^)]*\)/g, "0")
    .concat("\n.pointer-events-none { pointer-events: none; }");

/** The test DOM's selector engine cannot read a few of the sheet's selectors (`:is()` lists); every other rule stays. */
const dropRulesTheTestDomCannotMatch = (rules: CSSStyleSheet) => {
  for (let index = rules.cssRules.length - 1; index >= 0; index--) {
    const rule = rules.cssRules[index];
    if (!(rule instanceof CSSStyleRule)) continue;
    try {
      document.querySelector(rule.selectorText);
    } catch {
      rules.deleteRule(index);
    }
  }
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sheet = document.createElement("style");
  sheet.textContent = hudSheet();
  document.head.append(sheet);
  dropRulesTheTestDomCannotMatch(sheet.sheet!);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  sheet.remove();
});

it("lets a control in the action band take the pointer in the HUD's bands, which pass it to the map", () => {
  const onPress = vi.fn();
  act(() =>
    root.render(
      <HudBands
        strip={null}
        action={
          <HudButton kind="quiet" onClick={onPress}>
            {CANCEL}
          </HudButton>
        }
      />,
    ),
  );
  const bar = [...host.querySelectorAll("button")].find((button) => button.textContent === CANCEL)!;
  expect(getComputedStyle(bar.closest("[aria-label='Frontier HUD']")!).pointerEvents).toBe("none");
  expect(getComputedStyle(bar).pointerEvents).toBe("auto");
  act(() => bar.click());
  expect(onPress).toHaveBeenCalledOnce();
});
