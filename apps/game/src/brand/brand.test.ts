import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_FACES, HUD_COLORS, SHELL_COLORS } from "@/tokens";
import { FRONTIER_LOCKUP, REALMS_MARK } from "@/ui/design-system/icon-meaning";
import KIT from "./palette.json";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const PUBLIC = path("../../public/");

/** What brand v2 drew that v3 replaced: a surface naming one of these still wears the old brand. */
const RETIRED = [
  "Bokor",
  "Atkinson Hyperlegible",
  "atkinson-hyperlegible",
  "realms-lockup.svg",
  "realms-mark.svg",
  "eternum-loader.png",
  "Eternum-Mark-Black.png",
  // v2's muted text, now the kit's #B7A78A.
  "#a2926f",
];

/** Every surface that draws the brand: the app's code and pages, the docs site, the status page and the emails. */
const SURFACES = [
  ...sourcesUnder(path("../")),
  path("../../index.html"),
  path("../../tailwind.config.js"),
  path("../../public/404.html"),
  path("../../public/offline.html"),
  path("../../public/llm.txt"),
  path("../../../game-docs/docs/styles.css"),
  path("../../../game-docs/docs/pages/index.mdx"),
  path("../../../status/public/index.html"),
  path("../../../../packages/notifications/scripts/build-email-art.mjs"),
  path("../../../../packages/notifications/src/player-emails.ts"),
];

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx|css|html)$/.test(file) && !file.endsWith("brand.test.ts"))
    .map((file) => `${dir}${file}`);
}

const publicFile = (url: string) => `${PUBLIC}${url.replace(/^\//, "")}`;

describe("the brand comes from the Realms Brand Kit v3", () => {
  it("draws the kit's own colours for every role the kit names", () => {
    const kit = (name: keyof typeof KIT.brand) => KIT.brand[name].toLowerCase();
    for (const palette of [HUD_COLORS, SHELL_COLORS]) {
      expect({
        ground: palette.ground,
        plate: palette.plate,
        line: palette.line,
        cream: palette.cream,
        muted: palette.muted,
        gold: palette.gold,
        gold2: palette.gold2,
      }).toEqual({
        ground: kit("hearth"),
        plate: kit("plate"),
        line: kit("line"),
        cream: kit("cream"),
        muted: kit("muted"),
        gold: kit("action-gold"),
        gold2: kit("mark-gold"),
      });
    }
  });

  it("serves every face and mark it names", () => {
    const files = [
      ...FONT_FACES.map((face) => /url\("([^"]+)"\)/.exec(face.src)![1]),
      ...Object.values(REALMS_MARK),
      FRONTIER_LOCKUP,
    ];
    expect(files.filter((file) => !existsSync(publicFile(file)))).toEqual([]);
  });

  it("leaves no surface on a retired brand value", () => {
    const hits = SURFACES.flatMap((file) => {
      const text = readFileSync(file, "utf8").toLowerCase();
      return RETIRED.filter((value) => text.includes(value.toLowerCase())).map(
        (value) => `${file.replace(path("../../../../"), "")}: ${value}`,
      );
    });
    expect(hits).toEqual([]);
  });
});
