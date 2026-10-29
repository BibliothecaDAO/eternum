// What the email headers are drawn from, for scripts/build-email-art.mjs and for the check that the headers it wrote
// are not older than these: each email's painting and title, and the brand's ground, gold, lettered mark and heading
// face (src/brand.gen.json, written from the game's token file).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const publicDir = new URL("../../../apps/game/public/", import.meta.url);
export const BRAND = JSON.parse(await readFile(new URL("../src/brand.gen.json", import.meta.url), "utf8"));

/** Each email's painting, where its crop sits (0 top, 1 bottom), and its title. */
export const ART = {
  "sign-in-code": { painting: "frontier-mist", focus: 0.55, title: "Your sign-in code" },
  "wallet-changed": { painting: "season-citadel", focus: 0.45, title: "Payout wallet changed" },
  "wallet-unlinked": { painting: "season-citadel", focus: 0.45, title: "Payout wallet unlinked" },
};

export const paintingFile = (name) => new URL(`images/landscapes/${name}-1536.webp`, publicDir);
export const markFile = () => new URL(BRAND.marks.lettered.slice(1), publicDir);
export const headingFontFile = () => new URL(BRAND.faces.display.files[0].slice(1), publicDir);

/** One digest of every input: a header drawn from other inputs carries another. */
export const inputsDigest = async () => {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ art: ART, ground: BRAND.colors.ground, gold2: BRAND.colors.gold2 }));
  const paintings = [...new Set(Object.values(ART).map((art) => art.painting))];
  for (const file of [...paintings.map(paintingFile), markFile(), headingFontFile()]) hash.update(await readFile(file));
  return hash.digest("hex");
};
