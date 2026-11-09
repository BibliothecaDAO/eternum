// @vitest-environment node
import { readFileSync } from "node:fs";
import { isValidElement } from "react";
import { createRoutesFromChildren, matchRoutes, Navigate, type RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";

import iosApp from "../../ios/capacitor.config";
import { parseShellRoutes } from "../scripts/shell-routes.mjs";
import { appRoutes, RETIRED_PATHS } from "./app";

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

/** The shell's pages as the deploy check reads them too (scripts/shell-routes.mjs): one parser, one list. */
const shellRewrites = parseShellRoutes(readHostingFile("_redirects"));

/** Each `_headers` rule: its path pattern on the first line, then its headers. */
const headerRules = readHostingFile("_headers").split(/\n(?=\/)/);

const pathOfRule = (rule: string) => rule.split("\n")[0].trim();

const noCachePaths = headerRules.filter((rule) => /Cache-Control:\s*no-cache/i.test(rule)).map(pathOfRule);

/** `/` is the shell's own file, first on the list; every other page reaches it only through a rewrite. */
const servesShell = (path: string) => shellRewrites.some((pattern) => matchesPagesPattern(pattern, path));

const joinPath = (parent: string, path: string) => (path.startsWith("/") ? path : `${parent}/${path}`);

/** Every full path the router renders a page for, `:param` and `/*` included; the not-found catch-all is not a page. */
const routerPaths = (children: RouteObject[], parent = ""): string[] =>
  children.flatMap((route) => {
    const path = route.path === undefined ? parent : joinPath(parent, route.path);
    const own = route.path === undefined && !route.index ? [] : [path || "/"];
    return [...own, ...routerPaths(route.children ?? [], path)];
  });

const retired: readonly string[] = RETIRED_PATHS;

/** The router's pages: not its not-found catch-all, and not Play's former pages, which only lead to Play. */
const pagePaths = [...new Set(routerPaths(routes))].filter(
  (path) => path !== NOT_FOUND_PATH && !retired.includes(path),
);

/** Each `_redirects` rule as its source path, target and status. */
const redirectRules = readHostingFile("_redirects")
  .split("\n")
  .map((line) => line.trim().split(/\s+/))
  .filter(([from]) => from?.startsWith("/"));

/** The paths `_redirects` sends permanently to Play. */
const redirectsToPlay = redirectRules.filter(([, to, status]) => to === "/" && status === "301").map(([from]) => from);

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

  it("send Play's former pages, shared publicly, to Play: a permanent redirect on a full load, Play in the app", () => {
    expect(redirectsToPlay).toEqual(retired);
    for (const path of retired) {
      expect(servesShell(path), path).toBe(false);
      const element = matchRoutes(routes, path)?.at(-1)?.route.element;
      expect(isValidElement(element) && element.type === Navigate && (element.props as { to: string }).to, path).toBe(
        "/",
      );
    }
    // A lobby under the old list's address stays a page of its own.
    expect(servesShell("/blitz/slot-blitz-1")).toBe(true);
    expect(isPage("/blitz/slot-blitz-1")).toBe(true);
  });

  it("serve the shell for nothing that is not a page, so missing assets stay 404s", () => {
    const urls = [...shellRewrites.flatMap(sampleUrls), "/assets/missing.js", "/models/missing.glb", "/missing"];
    expect(urls.filter((url) => servesShell(url) && !isPage(url))).toEqual([]);
  });
});

/** The iOS app's association: the pages it opens (universal links) and the passkeys it shares with the site. */
const APPLE_APP_SITE_ASSOCIATION = "/.well-known/apple-app-site-association";

type AppleAppSiteAssociation = {
  applinks: { details: { appIDs: string[]; components: { "/": string }[] }[] };
  webcredentials: { apps: string[] };
};

const association: AppleAppSiteAssociation = JSON.parse(readHostingFile(APPLE_APP_SITE_ASSOCIATION.slice(1)));

describe("the iOS app's association", () => {
  it("is served as JSON at its own address, never through a redirect or the shell", () => {
    const rule = headerRules.find((candidate) => pathOfRule(candidate) === APPLE_APP_SITE_ASSOCIATION);
    expect(rule).toMatch(/Content-Type:\s*application\/json/i);
    expect(redirectRules.filter(([from]) => matchesPagesPattern(from, APPLE_APP_SITE_ASSOCIATION))).toEqual([]);
  });

  it("opens the app on the router's pages only", () => {
    const linkPaths = association.applinks.details.flatMap((detail) => detail.components.map((path) => path["/"]));
    const pageUrls = pagePaths.flatMap(sampleUrls);
    expect(linkPaths.filter((path) => !pageUrls.some((url) => matchesPagesPattern(path, url)))).toEqual([]);
  });

  // Empty until the owner adds the Apple Team ID (apps/ios/README.md); then each entry is `<Team ID>.<bundle id>`.
  it("names the iOS app by its Team ID and bundle id, the same app for links and passkeys", () => {
    const appIDs = association.applinks.details.flatMap((detail) => detail.appIDs);
    expect(association.webcredentials.apps).toEqual(appIDs);
    for (const appID of appIDs) {
      const [teamId, ...bundleId] = appID.split(".");
      expect(teamId, appID).toMatch(/^[A-Z0-9]{10}$/);
      expect(bundleId.join("."), appID).toBe(iosApp.appId);
    }
  });
});
