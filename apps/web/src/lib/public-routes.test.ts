import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const routeTreeSource = readFileSync(resolve(currentDir, "../routeTree.gen.ts"), "utf8");

const publicRoutes = [
  "/",
  "/account",
  "/blitz",
  "/eternum",
  "/games",
  "/games/$slug",
  "/privacy",
  "/scroll",
  "/scroll/$slug",
  "/stats",
  "/stats/revenue",
  "/stats/rewards",
  "/stats/rewards/$tab",
  "/stats/season-pass",
  "/terms",
] as const;

describe("public route contract", () => {
  it.each(publicRoutes)("exposes %s from the unified web app", (route) => {
    expect(routeTreeSource).toContain(`'${route}': typeof`);
  });
});
