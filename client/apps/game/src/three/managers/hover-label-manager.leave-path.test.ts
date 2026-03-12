import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readHoverLabelManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "hover-label-manager.ts"), "utf8");
}

describe("HoverLabelManager leave path", () => {
  it("uses one teardown path when the cursor leaves the grid", () => {
    const source = readHoverLabelManagerSource();
    const onHexLeaveStart = source.indexOf("onHexLeave()");
    const updateCameraViewStart = source.indexOf("updateCameraView(", onHexLeaveStart);
    const methodSource = onHexLeaveStart >= 0 && updateCameraViewStart > onHexLeaveStart
      ? source.slice(onHexLeaveStart, updateCameraViewStart)
      : "";

    expect(methodSource).not.toMatch(/controller\.hide\(activeId\)/);
    expect(methodSource).toMatch(/hideAll\?\.\(\)/);
  });
});
