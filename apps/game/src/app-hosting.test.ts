// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRoutesFromChildren, matchRoutes, type RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { appRoutes } from "./app";

/**
 * Cloudflare Pages answers a full page load, such as an OAuth return, with the app shell only where `_redirects`
 * rewrites the path to it; any other path, a missing asset included, gets the 404 page. These tests hold the hosting
 * files to the router: every page loads directly, and nothing that is not a page does.
 */

const NOT_FOUND_PATH = "/*";

const routes = createRoutesFromChildren(appRoutes);

const readHostingFile = (name: string) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

/** A Pages path pattern: `:name` matches one segment, `*` matches the rest of the path. */
const matchesPagesPattern = (pattern: string, path: string) => {
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:\w+/g, "[^/]+")
    .replace(/\*/g, ".*");
  return new RegExp(`^${source}$`).test(path);
};

const shellRewrites = readHostingFile("_redirects")
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter(([from, to, status]) => from?.startsWith("/") && to === "/" && status === "200")
  .map(([from]) => from);

const noCachePaths = readHostingFile("_headers")
  .split(/\n(?=\/)/)
  .filter((block) => /Cache-Control:\s*no-cache/i.test(block))
  .map((block) => block.split("\n")[0].trim());

/** `/` is the shell's own file; every other path reaches it only through a rewrite. */
const servesShell = (path: string) =>
  path === "/" || shellRewrites.some((pattern) => matchesPagesPattern(pattern, path));

const joinPath = (parent: string, path: string) => (path.startsWith("/") ? path : `${parent}/${path}`);

/** Every full path the router renders a page for, `:param` and `/*` included; the not-found catch-all is not a page. */
const routerPaths = (children: RouteObject[], parent = ""): string[] =>
  children.flatMap((route) => {
    const path = route.path === undefined ? parent : joinPath(parent, route.path);
    const own = route.path === undefined && !route.index ? [] : [path || "/"];
    return [...own, ...routerPaths(route.children ?? [], path)];
  });

const pagePaths = [...new Set(routerPaths(routes))].filter((path) => path !== NOT_FOUND_PATH);

/** URLs a pattern matches. A router splat also matches nothing, which a Pages splat does not, so both are sampled. */
const sampleUrls = (pattern: string) => {
  const filled = pattern.replace(/:\w+/g, "x");
  if (!filled.endsWith("/*")) return [filled];
  const base = filled.slice(0, -2);
  return [base || "/", `${base}/x`, `${base}/x/x`];
};

/** A path the router renders a page for, rather than its not-found catch-all. */
const isPage = (path: string) => {
  const leaf = matchRoutes(routes, path)?.at(-1)?.route;
  return leaf !== undefined && leaf.path !== "*";
};

describe("hosting files", () => {
  it("load every page of the router directly, with a revalidated shell", () => {
    const urls = pagePaths.flatMap(sampleUrls);
    expect(urls.filter((url) => !servesShell(url))).toEqual([]);
    expect(urls.filter((url) => !noCachePaths.some((pattern) => matchesPagesPattern(pattern, url)))).toEqual([]);
  });

  it("serve the shell for nothing that is not a page, so missing assets stay 404s", () => {
    const urls = [...shellRewrites.flatMap(sampleUrls), "/assets/missing.js", "/models/missing.glb", "/missing"];
    expect(urls.filter((url) => servesShell(url) && !isPage(url))).toEqual([]);
  });
});
