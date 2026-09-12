import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Vite may emit several entry scripts; checking only the first vendor misses a stale main entry. */
export async function readClientModuleEntries(dist) {
  const html = await readFile(join(dist, "index.html"), "utf8");
  const entries = [...html.matchAll(/<script\b[^>]*>/g)].flatMap(([tag]) => {
    const src = tag.match(/\bsrc="(\/assets\/[^" ]+\.js)"/)?.[1];
    return /\btype="module"/.test(tag) && src ? [src] : [];
  });
  if (!entries.length) throw new Error("Build HTML has no module entry");
  return entries;
}
