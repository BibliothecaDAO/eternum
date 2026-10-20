#!/usr/bin/env node
/**
 * The docs' images, videos and icons live in the game's public folder, which the docs build does not copy. After
 * `vocs build`, this ships exactly the files the built pages reference, from there into the build, and fails on any
 * reference that exists in neither: a renamed or deleted asset shows as a broken image on the site, never silently.
 * Run after `vocs build`: node scripts/ship-referenced-assets.mjs <dist>
 */
import fg from "fast-glob";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const GAME_PUBLIC = join(here, "../../game/public");
const ASSET = /\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|ico)$/i;

/**
 * Every site-relative file a built page loads: each src, poster, srcset candidate and CSS url(), whatever its
 * extension, plus links to an image or video. A file name may hold spaces; only a srcset candidate has a descriptor.
 */
export const referencedAssets = (html) => {
  const paths = new Set();
  const add = (value) => {
    const path = decodeURI(value.trim().split(/[?#]/)[0]);
    if (path.startsWith("/") && !path.startsWith("//")) paths.add(path);
  };
  for (const [, value] of html.matchAll(/\b(?:src|poster)="([^"]+)"/g)) add(value);
  for (const [, value] of html.matchAll(/\bhref="([^"]+)"/g)) if (ASSET.test(value.split(/[?#]/)[0])) add(value);
  for (const [, value] of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const candidate of value.split(",")) add(candidate.trim().replace(/\s+[\d.]+[wx]$/, ""));
  }
  for (const [, value] of html.matchAll(/url\((?:&quot;|["'])?([^)"'&]+)(?:&quot;|["'])?\)/g)) add(value);
  return paths;
};

/** Each referenced path, by the pages that name it. */
const referencesIn = (dist) => {
  const pages = new Map();
  for (const file of fg.sync("**/*.html", { cwd: dist })) {
    for (const path of referencedAssets(readFileSync(join(dist, file), "utf8"))) {
      pages.set(path, [...(pages.get(path) ?? []), file]);
    }
  }
  return pages;
};

const isFile = (path) => existsSync(path) && statSync(path).isFile();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const broken = [];
  let shipped = 0;
  for (const [path, pages] of referencesIn(dist)) {
    if (isFile(join(dist, path))) continue;
    const source = join(GAME_PUBLIC, path);
    if (!isFile(source)) {
      broken.push({ path, pages });
      continue;
    }
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    copyFileSync(source, join(dist, path));
    shipped += 1;
  }
  for (const { path, pages } of broken) console.error(`${path}: no such asset, named by ${pages.join(", ")}`);
  if (broken.length) process.exit(1);
  console.log(`Shipped ${shipped} referenced assets; every image reference resolves.`);
}
