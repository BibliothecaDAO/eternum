import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { filesNamingCheckout } from "./check-no-build-paths.mjs";

const checkout = "/home/someone/checkouts/eternum";
const dist = mkdtempSync(join(tmpdir(), "docs-dist-"));
after(() => rmSync(dist, { recursive: true, force: true }));
mkdirSync(join(dist, "assets"));
mkdirSync(join(dist, "blitz"));

test("a build that names no checkout passes", async () => {
  writeFileSync(join(dist, "assets", "index-abc.js"), 'export const config={alias:{"@":"./docs"}}');
  writeFileSync(join(dist, "index.html"), "<html>home</html>");
  assert.deepEqual(await filesNamingCheckout(dist, checkout), []);
});

test("every built file holding the checkout's path is named, whatever its kind", async () => {
  writeFileSync(
    join(dist, "assets", "index-def.js"),
    `export const config={vite:{publicDir:"${checkout}/apps/game/public"}}`,
  );
  writeFileSync(join(dist, "blitz", "index.html"), `<html><script>"${checkout}/apps/game-docs/docs"</script></html>`);
  assert.deepEqual(await filesNamingCheckout(dist, checkout), [
    join("assets", "index-def.js"),
    join("blitz", "index.html"),
  ]);
});
