import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog, themes } from "./catalog.mjs";

const output = resolve(process.argv[2] ?? ".context/icon-study");
const root = fileURLToPath(new URL("../../", import.meta.url));
await mkdir(output, { recursive: true });
const sprite = await buildSprite();
await writeFile(`${output}/icons.svg`, sprite);
await writeFile(
  `${output}/catalog.json`,
  JSON.stringify({ themes, icons: catalog.map(({ body, detail, ...icon }) => icon) }, null, 2),
);
for (const file of ["viewer.css", "viewer.js"]) await copyFile(new URL(file, import.meta.url), `${output}/${file}`);
for (const file of [
  "atkinson-hyperlegible-next.woff2",
  "bokor-regular.ttf",
  "atkinson-hyperlegible-next.OFL.txt",
  "bokor-regular.OFL.txt",
]) {
  await copyFile(`${root}/apps/game/public/fonts/${file}`, `${output}/${file}`);
}
const viewerSource = await readFile(new URL("viewer.js", import.meta.url), "utf8");
const viewerScript = viewerSource.replace(
  'await fetch("catalog.json").then((response) => response.json())',
  JSON.stringify({ themes, icons: catalog.map(({ body, detail, ...icon }) => icon) }),
);
await writeFile(`${output}/index.html`, page(sprite, viewerScript));
console.log(
  JSON.stringify({
    output,
    themes: themes.length,
    iconsPerTheme: catalog.length,
    resourcesPerTheme: catalog.filter((i) => i.resourceId).length,
  }),
);

async function buildSprite() {
  const symbols = [];
  for (const theme of themes) {
    for (const icon of catalog) {
      const source = await readFile(`${root}/apps/game/asset-sources/icon-study/${theme.id}/${icon.id}.svg`, "utf8");
      const inner = source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
      const unique = inner.replaceAll(`cut-${icon.id}`, `cut-${theme.id}-${icon.id}`);
      symbols.push(`<symbol id="${theme.id}-${icon.id}" viewBox="0 0 24 24">${unique}</symbol>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${symbols.join("")}</svg>`;
}

function page(sprite, viewerScript) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Eternum · Icon directions</title><link rel="stylesheet" href="viewer.css"></head><body>${sprite}
<header><p class="eyebrow">ETERNUM / ICON STUDY / 01</p><h1>One language for the whole map.</h1><p>Choose a direction by comparing the same 107 symbols in the HUD and on the map. All 58 resources are included.</p></header>
<nav aria-label="Comparison controls"><fieldset><legend>Icon size</legend>${[16, 24, 32].map((size) => `<button data-size="${size}" aria-pressed="${size === 24}">${size} px</button>`).join("")}</fieldset><fieldset><legend>Recognition</legend><button id="labels" aria-pressed="true">Hide labels</button></fieldset><fieldset><legend>Map density</legend><button data-density="20" aria-pressed="true">Blitz · 20</button><button data-density="220" aria-pressed="false">Eternum · 220</button></fieldset><a href="../inventory/index.html">Inventory ↗</a></nav>
<p class="context">Neutral ivory means the object. Ownership alone adds colour: <span class="you">● you</span>, <span class="ally">■ ally</span>, <span class="enemy">▲ enemy</span>. Shape repeats colour. Fonts: Atkinson for reading, Bokor for titles.</p>
<main id="themes"></main><section class="reading"><h2>What did you see?</h2><p>Hide labels, choose any sample, and write what it looks like. Reveal the intended reading afterwards. This records a comparison, not a scored recognition test.</p><p id="sample-name">Choose an icon in a grid.</p><form id="reading-form"><label for="reading">Your reading</label><input id="reading" autocomplete="off" placeholder="e.g. a mine entrance"><button id="reveal" type="submit" disabled>Reveal intended reading</button></form><p id="intended" role="status"></p><ol id="readings"></ol><button id="download" type="button">Download readings</button></section>
<footer><p id="selection" role="status">No direction selected.</p><p>Phase 1 fixture. Maps use deterministic synthetic data; bands are illustrative, not game balance. Nothing here changes the game.</p></footer><script>${viewerScript}</script></body></html>`;
}
