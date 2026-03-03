import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { seedDataDir } from "../../src/cli";
import { embeddedData } from "../../src/embedded-data";

describe("seedDataDir", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it("writes all embedded data files to the target directory", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "seed-data-"));
    tempDirs.push(dir);

    seedDataDir(dir);

    for (const [relativePath, expectedContent] of Object.entries(embeddedData)) {
      const filePath = path.join(dir, relativePath);
      expect(existsSync(filePath), `expected ${relativePath} to exist`).toBe(true);
      expect(readFileSync(filePath, "utf8")).toBe(expectedContent);
    }
  });

  it("does not overwrite existing files", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "seed-data-existing-"));
    tempDirs.push(dir);

    // First seed
    seedDataDir(dir);

    // Overwrite one file manually
    const soulPath = path.join(dir, "soul.md");
    const customContent = "# Custom soul\n";
    require("node:fs").writeFileSync(soulPath, customContent, "utf8");

    // Re-seed should not overwrite
    seedDataDir(dir);

    expect(readFileSync(soulPath, "utf8")).toBe(customContent);
  });
});
