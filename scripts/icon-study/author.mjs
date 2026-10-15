import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { catalog, themes } from "./catalog.mjs";

const root = new URL("../../apps/game/asset-sources/icon-study/", import.meta.url);
await mkdir(root, { recursive: true });
for (const theme of themes) {
  const directory = new URL(`${theme.id}/`, root);
  await mkdir(directory, { recursive: true });
  for (const icon of catalog) {
    const content = theme.id === "signal" ? await steppedGlyph(icon) : vectorGlyph(icon, theme.id);
    await writeFile(new URL(`${icon.id}.svg`, directory), wrap(content));
  }
}
console.log(`Authored ${catalog.length} SVG masters per theme (${catalog.length * themes.length} total).`);

function wrap(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${content}</svg>\n`;
}

function vectorGlyph(icon, theme) {
  if (theme === "survey")
    return `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon.body}${icon.detail}</g>`;
  const id = `cut-${icon.id}`;
  return `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24"><g fill="white" stroke="white" stroke-width=".8" stroke-linejoin="round">${icon.body}</g><g fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon.detail}</g></mask></defs><path fill="currentColor" d="M0 0H24V24H0Z" mask="url(#${id})"/>`;
}

async function steppedGlyph(icon) {
  const { data, info } = await sharp(Buffer.from(wrap(vectorGlyph(icon, "banner"))))
    .resize(16, 16)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cells = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (data[(y * 16 + x) * info.channels + 3] < 110) continue;
      cells.push(`M${x * 1.5} ${y * 1.5}h1.5v1.5h-1.5Z`);
    }
  }
  if (!cells.length) throw new Error(`Empty stepped glyph: ${icon.id}`);
  return `<path fill="currentColor" shape-rendering="crispEdges" d="${cells.join("")}"/>`;
}
