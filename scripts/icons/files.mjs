import { access } from "node:fs/promises";

export async function validateIconFiles(icons, source, output) {
  for (const { id } of icons) {
    await access(`${source}/masters/${id}.png`);
    if (output) for (const size of [64, 128, 256]) await access(`${output}/${size}/${id}.webp`);
  }
}
