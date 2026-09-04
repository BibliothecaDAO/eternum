import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readStructureManagerSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "structure-manager.ts"), "utf8");
}

describe("structure manager visibility diff wiring", () => {
  it("derives the next pass from committed manager ownership and mutates only its diff", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/currentVisibleIds: this\.previousVisibleIds/);
    expect(source).toMatch(/refreshEntityIds: options\.refreshEntityIds/);
    expect(source).toMatch(/commitManagerVisibilityDiff\(\{/);
    expect(source).toMatch(/remove: \(entityId\) => this\.removeVisibleStructureInstance/);
    expect(source).toMatch(/add: \(structure\) => this\.addVisibleStructureInstance/);
    expect(source).toMatch(/this\.structureInstanceBindings\.set\(structure\.entityId, bindings\)/);
    expect(source).toMatch(/slots\[instanceIndex\] = undefined/);
    expect(source).not.toMatch(/slots\.findIndex/);
  });

  it("checks pass authority inside the scheduled commit before touching slots", () => {
    const source = readStructureManagerSource();
    const commitMethod = source.slice(
      source.indexOf("private commitVisibleStructureDiff("),
      source.indexOf("private addVisibleStructureInstance("),
    );

    expect(commitMethod).toMatch(/if \(this\.shouldDiscardVisibleStructurePass\(snapshot\)\)/);
    expect(commitMethod).toMatch(/isCurrent: \(\) => !this\.shouldDiscardVisibleStructurePass\(snapshot\)/);
  });

  it("includes transition-token ownership in async structure pass snapshots", () => {
    const source = readStructureManagerSource();

    expect(source).toMatch(/this\.captureVisibleStructurePassSnapshot\(options\.transitionToken\)/);
    expect(source).toMatch(
      /snapshot\.transitionToken !== undefined && snapshot\.transitionToken !== this\.latestTransitionToken/,
    );
  });
});
