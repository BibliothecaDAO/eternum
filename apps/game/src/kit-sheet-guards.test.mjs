import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { findUnownedKitSheetClasses } from "../scripts/kit-sheet-guards.mjs";

const withKitDir = (files, run) => {
  const dir = mkdtempSync(join(tmpdir(), "kit-sheet-guard-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content);
    }
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe("kit sheet class ownership guard", () => {
  it("passes on the real kit sheets", () => {
    expect(findUnownedKitSheetClasses()).toEqual([]);
  });

  it("refuses a ui-* or app-* class in a kit sheet that no kit component uses", () => {
    const errors = withKitDir(
      {
        "hud-elements.tsx": `export const HudButton = () => <button className="ui-button" />;`,
        "hud-sheet.css": `.ui-button {} .ui-screen-only {}`,
        "app-sheet.css": `.app-page-only {}`,
      },
      (kitDir) => findUnownedKitSheetClasses({ kitDir, allowed: {} }),
    );
    expect(errors).toEqual([
      expect.stringContaining("hud-sheet.css: .ui-screen-only"),
      expect.stringContaining("app-sheet.css: .app-page-only"),
    ]);
  });

  it("refuses stale baseline entries once removed or adopted by a kit component", () => {
    const errors = withKitDir(
      {
        "hud-elements.tsx": `export const HudSeat = () => <span className="ui-seat" />;`,
        "hud-sheet.css": `.ui-seat {}`,
        "app-sheet.css": ``,
      },
      (kitDir) =>
        findUnownedKitSheetClasses({
          kitDir,
          allowed: { "hud-sheet.css": new Set(["ui-seat", "ui-gone"]) },
        }),
    );
    expect(errors).toEqual([
      expect.stringContaining("baseline entry .ui-seat"),
      expect.stringContaining("baseline entry .ui-gone"),
    ]);
  });
});
