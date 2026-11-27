import { readFileSync } from "node:fs";
import { join } from "node:path";

export const installHudSheet = (): HTMLStyleElement => {
  const sheet = document.createElement("style");
  sheet.textContent = readFileSync(join(__dirname, "hud-sheet.css"), "utf8").replace(/theme\([^)]*\)/g, "0");
  document.head.append(sheet);
  for (let index = sheet.sheet!.cssRules.length - 1; index >= 0; index--) {
    const rule = sheet.sheet!.cssRules[index];
    if (!(rule instanceof CSSStyleRule)) continue;
    try {
      document.querySelector(rule.selectorText);
    } catch {
      sheet.sheet!.deleteRule(index);
    }
  }
  return sheet;
};
