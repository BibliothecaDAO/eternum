import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readManagerSource(fileName: string): string {
  return readFileSync(resolve(currentDir, fileName), "utf8");
}

function extractShowLabelSource(source: string): string {
  const start = source.indexOf("public showLabel");
  const end = source.indexOf("public hideLabel", start);
  if (start === -1 || end === -1) {
    return "";
  }

  return source.slice(start, end);
}

describe("hover label show contract", () => {
  it.each([
    ["army-manager.ts", "this.revealArmyLabel(entityId, label);"],
    ["structure-manager.ts", "this.labelsGroup.add(existingLabel);"],
    ["chest-manager.ts", "this.labelsGroup.add(existingLabel);"],
  ])("%s returns structured show results and reattaches existing detached labels", (fileName, reattachCall) => {
    const showLabelSource = extractShowLabelSource(readManagerSource(fileName));

    expect(showLabelSource).toContain(": HoverLabelShowResult");
    expect(showLabelSource).toContain('return { status: "missing" };');
    expect(showLabelSource).toContain('return { status: "shown" };');
    expect(showLabelSource).toContain('status: "reattached"');
    expect(showLabelSource).toContain('status: "unchanged"');
    expect(showLabelSource).toContain(reattachCall);
    expect(showLabelSource).toContain(".visible = true");
    expect(showLabelSource).toContain('.element.style.display = ""');
  });
});
