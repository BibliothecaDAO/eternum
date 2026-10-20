#!/usr/bin/env node
/**
 * The docs' images, videos and icons live in the game's public folder, which `vocs build` does not copy (`vocs dev`
 * serves it through `vite.publicDir`). After the build, this ships exactly the files the built pages reference, from
 * there into the build, and fails on any local link or file that resolves to nothing: a renamed page or a deleted asset
 * shows as a failed build, never as a broken link or image on the site.
 * Run after `vocs build`: node scripts/ship-referenced-assets.mjs <dist>
 */
import fg from "fast-glob";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const GAME_PUBLIC = join(here, "../../game/public");
const SITE = "https://docs.local";

/**
 * Every same-site path a built page names, resolved against the page: each href, src, poster, srcset candidate and
 * CSS url(). Other sites, mailto and data URLs are left out. A file name may hold spaces; only a srcset candidate has
 * a descriptor.
 */
export const localReferences = (html, page = "index.html") => {
  const base = new URL(`/${dirname(page)}/`.replace(/^\/\.\//, "/"), SITE);
  const paths = new Set();
  const add = (value) => {
    const url = new URL(value.trim().replaceAll("&amp;", "&"), base);
    if (url.origin === base.origin) paths.add(decodeURI(url.pathname));
  };
  for (const [, value] of html.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)) add(value);
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
    for (const path of localReferences(readFileSync(join(dist, file), "utf8"), file)) {
      pages.set(path, [...(pages.get(path) ?? []), file]);
    }
  }
  return pages;
};

const isFile = (path) => existsSync(path) && statSync(path).isFile();

/** A path the built site serves: a file, or a page as `<path>.html` or `<path>/index.html`. */
const isServedBy = (dist, path) =>
  isFile(join(dist, path)) || isFile(join(dist, `${path}.html`)) || isFile(join(dist, path, "index.html"));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const broken = [];
  let shipped = 0;
  for (const [path, pages] of referencesIn(dist)) {
    if (isServedBy(dist, path)) continue;
    const source = join(GAME_PUBLIC, path);
    if (!isFile(source)) {
      broken.push({ path, pages });
      continue;
    }
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    copyFileSync(source, join(dist, path));
    shipped += 1;
  }
  for (const { path, pages } of broken) console.error(`${path}: no such page or file, named by ${pages.join(", ")}`);
  if (broken.length) process.exit(1);
  console.log(`Shipped ${shipped} referenced files; every local link and image resolves.`);
}
