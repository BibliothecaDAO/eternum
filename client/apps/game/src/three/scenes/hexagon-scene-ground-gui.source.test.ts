import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const extractMethodBody = (source: string, methodName: string): string => {
  const methodStart = source.indexOf(methodName);
  expect(methodStart).toBeGreaterThan(-1);

  const bodyStart = source.indexOf("{", methodStart);
  expect(bodyStart).toBeGreaterThan(-1);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart, index + 1);
  }

  throw new Error(`Unable to extract ${methodName}`);
};

describe("hexagon scene ground GUI guard", () => {
  it("does not access the ground mesh GUI folder unless scene GUI setup exists", () => {
    const source = readFileSync(new URL("./hexagon-scene.ts", import.meta.url), "utf8");
    const body = extractMethodBody(source, "private setupGroundMeshGUI");

    expect(body).toContain("if (!this.GUIFolder)");
    expect(body.indexOf("if (!this.GUIFolder)")).toBeLessThan(body.indexOf('addFolder("Ground Mesh")'));
  });
});
