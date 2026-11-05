// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FONT_FACES, HUD_COLORS, SHELL_COLORS } from "@/tokens";
import { AGE_LOCKUP, LINK_PREVIEW, REALMS_MARK } from "@/ui/design-system/icon-meaning";
import { EMAIL_ART_INPUTS } from "../../../../packages/notifications/src/email-art.gen";
import { inputsDigest } from "../../../../packages/notifications/scripts/email-art-inputs.mjs";
import KIT from "./palette.json";
import { BRAND_SURFACES, writeSurface } from "./surfaces";

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
  // v2's link preview, "Realms · Conquer everything".
  "og-image.png",
  // v2's muted text, now the kit's #B7A78A.
  "#a2926f",
];

/** Every surface that draws the brand: the app's code and pages, the docs site, the status page and the emails. */
const SURFACES = [...sourcesUnder(path("../")), path("../../tailwind.config.js"), ...standaloneSurfaces()];

/**
 * The surfaces that cannot import the token file: each holds only the copy src/brand/surfaces.ts writes into it, and
 * names the brand's faces and marks through that copy, never on its own.
 */
function standaloneSurfaces(): string[] {
  return [
    path("../../index.html"),
    path("../../public/404.html"),
    path("../../public/offline.html"),
    path("../../public/llm.txt"),
    path("../../../game-docs/vocs.config.ts"),
    path("../../../game-docs/docs/styles.css"),
    path("../../../game-docs/docs/pages/index.mdx"),
    path("../../../status/public/index.html"),
    path("../../../../packages/notifications/scripts/build-email-art.mjs"),
    path("../../../../packages/notifications/scripts/email-art-inputs.mjs"),
    path("../../../../packages/notifications/scripts/email-art-title.mjs"),
    path("../../../../packages/notifications/src/player-emails.ts"),
  ];
}

/** The kit's small globes drawn for a favicon (01-Logos/Realms/Small/realms-small-32.png and -48.png), by their SHA-256. */
const KIT_SMALL_GLOBES = {
  "32x32": "66edcb26bb67c878498f92500c7bede6ab5fce05f7ff90336b3d8ae01f7a84c5",
  "48x48": "13478ed450ccfc155974399feb7f6586a3d21c55a7167bcc4ce90a51b98109b5",
};

/** An .ico's frames, each by its size and the SHA-256 of its stored bytes (a PNG frame is its file). */
const icoFrames = (file: string) => {
  const ico = readFileSync(file);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, index) => {
    const entry = 6 + 16 * index;
    const start = ico.readUInt32LE(entry + 12);
    const stored = ico.subarray(start, start + ico.readUInt32LE(entry + 8));
    return {
      size: `${ico[entry] || 256}x${ico[entry + 1] || 256}`,
      digest: createHash("sha256").update(stored).digest("hex"),
    };
  });
};

const REPO = path("../../../../");
const shortPath = (file: string) => file.replace(REPO, "");

/** A surface's own lines: what is left once the written brand block and theme colour are taken out. */
const ownLines = (text: string) =>
  text
    .replace(/\/\* brand: written from[\s\S]*?\/\* brand: end \*\//g, "")
    .replace(/<meta name="theme-color" content="[^"]*"/g, "");

/** A colour written out (hex, or rgb() other than black), a brand face named, a mark or face file named. */
const OWN_COLOUR = /(?<!&)#[0-9a-f]{3,8}\b|rgba?\((?!0, 0, 0|0 0 0)\d/gi;
const BRAND_FAMILY = new RegExp(
  [...new Set(FONT_FACES.map((font) => font.fontFamily.replaceAll('"', "")))].join("|"),
  "gi",
);
/** The kit's colours (its brand roles and each game's ground, title and stamp), each as hex or as `rgb()` channels. */
const KIT_COLOURS = [
  ...new Set([
    ...Object.values(KIT.brand),
    ...Object.values(KIT.games).flatMap((game) => [game.ground, game.title, game.stamp]),
  ]),
].map((hex) => {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return { hex, pattern: new RegExp(`${hex}\\b|\\b${r},?\\s*${g},?\\s*${b}\\b`, "i") };
});

const NAMED_FILE = /\/(?:images\/logos|fonts)\/[\w.-]+/g;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx|css|html)$/.test(file) && !file.endsWith("brand.test.ts"))
    .map((file) => `${dir}${file}`);
}

const publicFile = (url: string) => `${PUBLIC}${url.replace(/^\//, "")}`;
const fontFiles = () => FONT_FACES.map((face) => /url\("([^"]+)"\)/.exec(face.src)![1]);

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
    const files = [...fontFiles(), ...Object.values(REALMS_MARK), ...Object.values(AGE_LOCKUP)];
    expect(files.filter((file) => !existsSync(publicFile(file)))).toEqual([]);
  });

  it("writes no kit colour out in the app's code: it reads the token file", () => {
    const writtenOut = sourcesUnder(path("../"))
      .filter((file) => !/(\/tokens\.ts|\.test\.tsx?)$/.test(file))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return KIT_COLOURS.filter((colour) => colour.pattern.test(text)).map(
          (colour) => `${shortPath(file)}: ${colour.hex}`,
        );
      });
    expect(writtenOut).toEqual([]);
  });

  it("keeps the game's HUD on its reading face: no HUD code reads the app's labels face (Cinzel)", () => {
    const hud = ["../three/", "../ui/features/", "../ui/modules/", "../ui/components/"].flatMap((dir) =>
      sourcesUnder(path(dir)).filter((file) => !file.includes("/debug/")),
    );
    const readers = hud.filter((file) => /--font-ui|\bfont-ui\b/.test(readFileSync(file, "utf8")));
    expect(readers.map((file) => file.replace(path("../../../../"), ""))).toEqual([]);
  });

  it("holds on every standalone surface the copy the token file writes (pnpm --dir apps/game brand:surfaces)", () => {
    const stale = BRAND_SURFACES.filter((surface) => {
      const file = `${REPO}${surface.path}`;
      const text = existsSync(file) ? readFileSync(file, "utf8") : "";
      return writeSurface(surface, text) !== text;
    }).map((surface) => surface.path);
    expect(stale).toEqual([]);
  });

  it("writes no colour, face or mark of a standalone surface's own", () => {
    const served = new Set([...Object.values(REALMS_MARK), ...Object.values(AGE_LOCKUP), ...fontFiles()]);
    const own = standaloneSurfaces().flatMap((file) => {
      const text = ownLines(readFileSync(file, "utf8"));
      return [
        ...(text.match(OWN_COLOUR) ?? []),
        ...(text.match(BRAND_FAMILY) ?? []),
        ...(text.match(NAMED_FILE) ?? []).filter((named) => !served.has(named)),
      ].map((hit) => `${shortPath(file)}: ${hit}`);
    });
    expect(own).toEqual([]);
  });

  it("serves the kit's 32 and 48 px small globes as the favicon, byte for byte, and no other frame", () => {
    const html = readFileSync(path("../../index.html"), "utf8");
    expect(html).toContain(
      `<link rel="icon" href="/images/game-favicon.ico" sizes="${Object.keys(KIT_SMALL_GLOBES).join(" ")}" />`,
    );
    expect(
      Object.fromEntries(icoFrames(`${PUBLIC}images/game-favicon.ico`).map(({ size, digest }) => [size, digest])),
    ).toEqual(KIT_SMALL_GLOBES);
    // The dev favicon is the same two globes, each with its hatched corner.
    expect(icoFrames(`${PUBLIC}images/game-dev-favicon.ico`).map(({ size }) => size)).toEqual(
      Object.keys(KIT_SMALL_GLOBES),
    );
  });

  it("names the link preview by its content, so a new image is a new address", () => {
    const bytes = readFileSync(publicFile(LINK_PREVIEW));
    const digest = createHash("sha256").update(bytes).digest("hex");
    expect(LINK_PREVIEW).toBe(`/images/covers/link-preview-${digest.slice(0, 8)}.png`);
  });

  it("unfurls the game and the docs with the one link preview, LINK_PREVIEW", () => {
    const html = readFileSync(path("../../index.html"), "utf8");
    const unfurls = [...html.matchAll(/<meta (?:property|name)="(og:image|twitter:image)" content="([^"]*)"/g)];
    expect(unfurls.map(([, tag, content]) => `${tag} ${content}`)).toEqual([
      "og:image %LINK_PREVIEW%",
      "twitter:image %LINK_PREVIEW%",
    ]);
    const readme = readFileSync(`${REPO}README.md`, "utf8");
    expect(readme.match(/link-preview-[\w-]*\.png/g)).toEqual([LINK_PREVIEW.split("/").pop()]);
    const docs = readFileSync(path("../../../game-docs/vocs.config.ts"), "utf8");
    expect(docs).toMatch(/ogImageUrl: linkPreviewUrl\(/);
    // No surface names a preview image of its own, and the app serves no second copy of it.
    const named = SURFACES.filter((file) => !file.endsWith("/icon-meaning.ts")).flatMap((file) =>
      (readFileSync(file, "utf8").match(/(?:og-image|link-preview)[\w-]*\.(?:png|jpe?g|webp)/g) ?? []).map(
        (hit) => `${shortPath(file)}: ${hit}`,
      ),
    );
    expect(named).toEqual([]);
    const preview = readFileSync(publicFile(LINK_PREVIEW));
    const copies = readdirSync(PUBLIC, { recursive: true, encoding: "utf8" }).filter(
      (file) =>
        `/${file}` !== LINK_PREVIEW &&
        statSync(`${PUBLIC}${file}`).size === preview.length &&
        readFileSync(`${PUBLIC}${file}`).equals(preview),
    );
    expect(copies).toEqual([]);
  });

  it("sends the email headers drawn from today's brand (pnpm --dir packages/notifications build:email-art)", async () => {
    expect(EMAIL_ART_INPUTS).toBe(await inputsDigest());
  });

  it("leaves no surface on a retired brand value", () => {
    const hits = SURFACES.flatMap((file) => {
      const text = readFileSync(file, "utf8").toLowerCase();
      return RETIRED.filter((value) => text.includes(value.toLowerCase())).map(
        (value) => `${shortPath(file)}: ${value}`,
      );
    });
    expect(hits).toEqual([]);
  });
});
