import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The app's pages as Cloudflare Pages serves them: `/`, the shell's own file, and every path `_redirects` rewrites to
 * it. src/app-hosting.test.ts holds that file to exactly the router's routes in src/app.tsx, so this is the router's
 * list as data a plain node script can read, at build time from public/ and at deploy time from dist/.
 */
export const parseShellRoutes = (redirects) => [
  "/",
  ...redirects
    .split("\n")
    .map((line) => line.trim().split(/\s+/))
    .filter(([from, to, status]) => from?.startsWith("/") && to === "/" && status === "200")
    .map(([from]) => from),
];

export const readShellRoutes = async (dir) => parseShellRoutes(await readFile(join(dir, "_redirects"), "utf8"));

/** One URL a Pages pattern serves: each `:param` and a trailing splat filled with a sample segment. */
export const sampleShellRoute = (pattern) => pattern.replace(/:\w+/g, "x").replace(/\*$/, "x");
