import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { verifyClientDeployment } from "./verify-client-deployment.mjs";

test("deployment gate rejects HTML modules, stale bytes and cached shells", async () => {
  const dist = await mkdtemp(join(tmpdir(), "client-deploy-test-"));
  const html = '<script type="module" src="/assets/main-abc.js"></script>';
  const js = 'console.log("current build");';
  await mkdir(join(dist, "assets"));
  await writeFile(join(dist, "index.html"), html);
  await writeFile(join(dist, "assets/main-abc.js"), js);
  let mode = "healthy";
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", mode === "cached-shell" ? "public, max-age=300" : "no-cache");
    if (request.url.startsWith("/assets/deployment-check-missing")) {
      response.statusCode = mode === "spa-fallback" ? 200 : 404;
      response.end(html);
    } else if (request.url === "/assets/main-abc.js") {
      response.setHeader("Content-Type", mode === "html-module" ? "text/html" : "application/javascript");
      response.end(mode === "stale-module" ? 'console.log("old build");' : mode === "html-module" ? html : js);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(html);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await verifyClientDeployment(dist, origin)).ok, true);
    for (mode of ["html-module", "stale-module", "cached-shell", "spa-fallback"]) {
      assert.equal((await verifyClientDeployment(dist, origin)).ok, false, mode);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dist, { recursive: true, force: true });
  }
});
