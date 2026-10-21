import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { pagePath, verifyDocsDeployment } from "./verify-docs-deployment.mjs";

const dist = mkdtempSync(join(tmpdir(), "docs-dist-"));
after(() => rmSync(dist, { recursive: true, force: true }));
mkdirSync(join(dist, "assets"));
mkdirSync(join(dist, "blitz", "key-concepts"), { recursive: true });
writeFileSync(join(dist, "assets", "index-abc123.js"), "console.log('this build')");
writeFileSync(join(dist, "index.html"), "<html>home</html>");
writeFileSync(join(dist, "blitz", "key-concepts", "index.html"), "<html>key concepts</html>");

/** A site at a local address that answers each path from `routes`, as Pages would serve it. */
async function serve(routes) {
  const server = createServer((request, response) => {
    const route = routes[request.url];
    if (!route) return response.writeHead(404).end();
    response.writeHead(200, { "content-type": route.type }).end(route.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

const page = (body) => ({ type: "text/html; charset=utf-8", body });
const script = (body) => ({ type: "application/javascript", body });

test("a page's address is its folder for an index page", () => {
  assert.equal(pagePath("index.html"), "/");
  assert.equal(pagePath(join("blitz", "key-concepts", "index.html")), "/blitz/key-concepts/");
  assert.equal(pagePath(join("overview", "links.html")), "/overview/links");
});

test("a site serving this build's assets and every page passes", async () => {
  const origin = await serve({
    "/assets/index-abc123.js": script("console.log('this build')"),
    "/": page("<html>home</html>"),
    "/blitz/key-concepts/": page("<html>key concepts</html>"),
  });
  const result = await verifyDocsDeployment(dist, origin);
  assert.deepEqual(
    { ok: result.ok, assets: result.assets, pages: result.pages, failed: result.checks.filter((c) => !c.ok) },
    { ok: true, assets: 1, pages: 2, failed: [] },
  );
});

test("a site still serving another build's asset bytes fails on that asset", async () => {
  const origin = await serve({
    "/assets/index-abc123.js": script("console.log('an older build')"),
    "/": page("<html>home</html>"),
    "/blitz/key-concepts/": page("<html>key concepts</html>"),
  });
  const result = await verifyDocsDeployment(dist, origin);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.checks.filter((check) => !check.ok).map((check) => check.path),
    ["/assets/index-abc123.js"],
  );
});

test("a page the build wrote but the site does not serve fails on that page", async () => {
  const origin = await serve({
    "/assets/index-abc123.js": script("console.log('this build')"),
    "/": page("<html>home</html>"),
  });
  const result = await verifyDocsDeployment(dist, origin);
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.checks.filter((check) => !check.ok).map((check) => [check.path, check.status]),
    [["/blitz/key-concepts/", 404]],
  );
});
