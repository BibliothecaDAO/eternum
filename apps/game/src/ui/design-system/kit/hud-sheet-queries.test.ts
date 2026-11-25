// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

import { HUD_QUERIES } from "@/tokens";

const HUD_ROOTS = [join(__dirname, "hud-sheet.css"), join(__dirname, "../../features/frontier")];

const filesUnder = (path: string, extension: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => filesUnder(join(path, name), extension))
    : path.endsWith(extension)
      ? [path]
      : [];

const handoverQueries = HUD_ROOTS.flatMap((root) => filesUnder(root, ".css")).flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/@media ([^{]+)\{/g)]
    .map(([, query]) => query.trim())
    .filter((query) => /\b(1023|1024|1439|1440)px\b/.test(query))
    .map((query) => ({ file, query })),
);

it("lays every HUD stylesheet out by the HUD's own queries, never a width written by hand", () => {
  expect(handoverQueries.length).toBeGreaterThan(0);
  const known = new Set<string>(Object.values(HUD_QUERIES));
  expect(handoverQueries.filter(({ query }) => !known.has(query))).toEqual([]);
});

const APP_SOURCE = join(__dirname, "../../..");

const readsTheHudLane = (file: string) => readFileSync(file, "utf8").includes("@/hooks/helpers/use-compact-hud");

it("switches every class the HUD's layout draws by the HUD's variants, never by Tailwind's lg", () => {
  const frontier = filesUnder(join(__dirname, "../../features/frontier"), ".tsx");
  const laneReaders = filesUnder(APP_SOURCE, ".tsx").filter(readsTheHudLane);
  const kitSheet = [join(__dirname, "sheet.tsx"), join(__dirname, "sheet-closes.tsx")];
  const drawn = [...new Set([...frontier, ...laneReaders, ...kitSheet])].filter((file) => !file.endsWith(".test.tsx"));
  const lg = drawn.filter((file) => /["'`\s](max-)?lg:[\w[-]/.test(readFileSync(file, "utf8")));
  expect(lg).toEqual([]);
});
