import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readLabelFactorySource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "label-factory.ts"), "utf8");
}

function readLabelComponentsSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "label-components.ts"), "utf8");
}

describe("structure label stable node updates", () => {
  it("keeps the existing guard and production containers instead of replacing those DOM nodes", () => {
    const labelFactorySource = readLabelFactorySource();
    const labelComponentsSource = readLabelComponentsSource();

    expect(labelFactorySource).not.toMatch(/replaceWith\(newGuardDisplay\)/);
    expect(labelFactorySource).not.toMatch(/replaceWith\(newProductionsDisplay\)/);
    expect(labelComponentsSource).toMatch(/existingIndicators instanceof HTMLElement/);
  });
});
