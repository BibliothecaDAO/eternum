import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateIconFiles } from "./files.mjs";

test("the build file check rejects missing masters and exports", async () => {
  const root = await mkdtemp(join(tmpdir(), "facets-files-"));
  const icons = [{ id: "production" }];
  try {
    await assert.rejects(validateIconFiles(icons, root, root), /masters\/production.png/);
    await mkdir(join(root, "masters"));
    await writeFile(join(root, "masters/production.png"), "fixture");
    for (const size of [64, 128, 256]) {
      await assert.rejects(validateIconFiles(icons, root, root), new RegExp(`${size}/production.webp`));
      await mkdir(join(root, String(size)));
      await writeFile(join(root, String(size), "production.webp"), "fixture");
    }
    await assert.doesNotReject(validateIconFiles(icons, root, root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
