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

/** This build as the site should serve it: each built file at its address, with these exact bytes. */
const THIS_BUILD = {
  "/assets/index-abc123.js": script("console.log('this build')"),
  "/": page("<html>home</html>"),
  "/blitz/key-concepts/": page("<html>key concepts</html>"),
};

/** The checks a site answering `routes` fails, as [path, status]. */
async function failedAgainst(routes) {
  const result = await verifyDocsDeployment(dist, await serve(routes));
  const failed = result.checks.filter((check) => !check.ok).map((check) => [check.path, check.status]);
  assert.equal(result.ok, failed.length === 0);
  return failed;
}

test("a site serving this build's assets and every page as built passes", async () => {
  const result = await verifyDocsDeployment(dist, await serve(THIS_BUILD));
  assert.deepEqual(
    { ok: result.ok, assets: result.assets, pages: result.pages, failed: result.checks.filter((c) => !c.ok) },
    { ok: true, assets: 1, pages: 2, failed: [] },
  );
});

test("a site still serving another build's asset bytes fails on that asset", async () => {
  const routes = { ...THIS_BUILD, "/assets/index-abc123.js": script("console.log('an older build')") };
  assert.deepEqual(await failedAgainst(routes), [["/assets/index-abc123.js", 200]]);
});

test("a fallback page answering 200 at an asset's address fails on that asset", async () => {
  const routes = { ...THIS_BUILD, "/assets/index-abc123.js": page("<html>home</html>") };
  assert.deepEqual(await failedAgainst(routes), [["/assets/index-abc123.js", 200]]);
});

test("a not-found page answering 200 at a page's address fails on that page, though every asset is this build's", async () => {
  const routes = { ...THIS_BUILD, "/blitz/key-concepts/": page("<html>Page Not Found</html>") };
  assert.deepEqual(await failedAgainst(routes), [["/blitz/key-concepts/", 200]]);
});

test("an older build's page answering 200 fails on that page, though every asset is this build's", async () => {
  const routes = { ...THIS_BUILD, "/": page("<html>home, as the last build wrote it</html>") };
  assert.deepEqual(await failedAgainst(routes), [["/", 200]]);
});

test("a page the build wrote but the site does not serve fails on that page", async () => {
  const { "/blitz/key-concepts/": _missing, ...routes } = THIS_BUILD;
  assert.deepEqual(await failedAgainst(routes), [["/blitz/key-concepts/", 404]]);
});
