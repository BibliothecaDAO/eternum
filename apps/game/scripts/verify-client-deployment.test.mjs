import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { verifyClientDeployment } from "./verify-client-deployment.mjs";

test("deployment gate rejects HTML modules, stale bytes and cached shells", async () => {
  const dist = await mkdtemp(join(tmpdir(), "client-deploy-test-"));
  const html =
    '<script type="module" src="/assets/vendor-shared.js"></script><script type="module" src="/assets/main-abc.js"></script>';
  const js = 'console.log("current build");';
  await mkdir(join(dist, "assets"));
  await writeFile(join(dist, "index.html"), html);
  await writeFile(join(dist, "assets/main-abc.js"), js);
  await writeFile(join(dist, "assets/vendor-shared.js"), js);
  const modelUrls = {
    "/models/terrain-flora/manifest.json": "/models/terrain-flora/manifest.7f0f65a28a3e.json",
    "/models/terrain-flora/birch.glb": "/models/terrain-flora/birch.fd8ea8d33f39.glb",
  };
  const installAssets = {
    "/sw.js": [js, "application/javascript"],
    "/manifest.webmanifest": ['{"name":"Realms"}', "application/manifest+json"],
    "/offline.html": ["Offline", "text/html"],
    "/model-urls.json": [JSON.stringify(modelUrls), "application/json"],
  };
  const publishedModels = {
    "/models/terrain-flora/manifest.7f0f65a28a3e.json": "application/json",
    "/models/terrain-flora/birch.fd8ea8d33f39.glb": "model/gltf-binary",
  };
  for (const [path, [body]] of Object.entries(installAssets)) await writeFile(join(dist, path.slice(1)), body);
  await writeFile(join(dist, "_redirects"), "/season / 200\n/blitz/:id / 200\n/g/:chain/:game/* / 200\n");
  let mode = "healthy";
  const requested = [];
  const server = createServer((request, response) => {
    requested.push(request.url);
    response.setHeader("Cache-Control", mode === "cached-shell" ? "public, max-age=300" : "no-cache");
    if (installAssets[request.url]) {
      const [body, type] = installAssets[request.url];
      response.setHeader("Content-Type", mode === "html-worker" && request.url === "/sw.js" ? "text/html" : type);
      if (mode === "cached-worker" && request.url === "/sw.js") response.setHeader("Cache-Control", "max-age=14400");
      response.end(
        mode === "stale-worker" && request.url === "/sw.js"
          ? "old worker"
          : mode === "stale-model-urls" && request.url === "/model-urls.json"
            ? "{}"
            : body,
      );
    } else if (publishedModels[request.url]) {
      if (mode === "missing-model" && request.url.endsWith(".json")) {
        response.statusCode = 404;
        response.end("Not found");
      } else {
        response.setHeader(
          "Cache-Control",
          mode === "mutable-model" ? "public, max-age=60" : "public, max-age=31536000, immutable",
        );
        response.setHeader("Content-Type", mode === "html-model" ? "text/html" : publishedModels[request.url]);
        response.end();
      }
    } else if (request.url.startsWith("/assets/deployment-check-missing")) {
      response.statusCode = mode === "spa-fallback" ? 200 : 404;
      response.end(html);
    } else if (["/assets/main-abc.js", "/assets/vendor-shared.js"].includes(request.url)) {
      response.setHeader("Content-Type", mode === "html-module" ? "text/html" : "application/javascript");
      response.end(mode === "stale-module" ? 'console.log("old build");' : mode === "html-module" ? html : js);
    } else if (mode === "route-missing" && request.url === "/season") {
      response.statusCode = 404;
      response.end("Not found");
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(mode === "stale-main-entry" ? html.replace("main-abc.js", "main-old.js") : html);
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await verifyClientDeployment(dist, origin)).ok, true);
    // The pages it asks for are the build's own list (its _redirects, held to the router), never a list of its own.
    const pages = requested.filter(
      (url) => !url.startsWith("/assets/") && !url.startsWith("/models/") && !installAssets[url],
    );
    assert.deepEqual(pages.toSorted(), ["/", "/blitz/x", "/g/0x1/1/map?spectate=true", "/g/x/x/x", "/season"]);
    assert.equal(pages.includes("/play"), false);
    for (mode of [
      "html-module",
      "stale-module",
      "cached-shell",
      "spa-fallback",
      "stale-main-entry",
      "route-missing",
      "cached-worker",
      "html-worker",
      "stale-worker",
      "stale-model-urls",
      "missing-model",
      "html-model",
      "mutable-model",
    ]) {
      assert.equal((await verifyClientDeployment(dist, origin)).ok, false, mode);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dist, { recursive: true, force: true });
  }
});
