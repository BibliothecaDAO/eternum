#!/usr/bin/env node
/**
 * The docs' images, videos and icons live in the game's public folder, which `vocs build` does not copy (`vocs dev`
 * serves it through `vite.publicDir`). After the build, this ships exactly the files the built pages reference, from
 * there into the build, and fails on any local link or file that resolves to nothing: a renamed page or a deleted asset
 * shows as a failed build, never as a broken link or image on the site.
 * Run after `vocs build`: node scripts/ship-referenced-assets.mjs <dist> [redirects file, default ../_redirects]
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

const REDIRECTS = join(here, "../_redirects");
const DOCS_MEDIA = join(GAME_PUBLIC, "docs-media");

const unreferencedDocsMedia = (docsMediaDir, referenced) => {
  if (!existsSync(docsMediaDir)) return [];
  return fg
    .sync("**/*", { cwd: docsMediaDir, onlyFiles: true })
    .map((file) => `/docs-media/${file}`)
    .filter((path) => !referenced.has(path))
    .sort();
};

/** The moved pages' redirects, each line `<old> <new> <status>`; comments and blank lines left out. */
export const redirectsOf = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [from, to] = line.split(/\s+/);
      return { from, to };
    });

/** A path the built site serves: a file, or a page as `<path>.html` or `<path>/index.html`. */
const isServedBy = (dist, path) =>
  isFile(join(dist, path)) || isFile(join(dist, `${path}.html`)) || isFile(join(dist, path, "index.html"));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] ?? join(here, "../dist"));
  const redirects = resolve(process.argv[3] ?? REDIRECTS);
  const docsMedia = resolve(process.argv[4] ?? DOCS_MEDIA);
  const references = referencesIn(dist);
  const broken = [];
  let shipped = 0;
  for (const [path, pages] of references) {
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
  const unused = unreferencedDocsMedia(docsMedia, new Set(references.keys()));
  const live = [];
  for (const { from, to } of redirectsOf(readFileSync(redirects, "utf8"))) {
    if (!isServedBy(dist, to)) broken.push({ path: to, pages: [`_redirects (from ${from})`] });
    if (isServedBy(dist, from.replace(/\/$/, "") || "/")) live.push(from);
  }
  copyFileSync(redirects, join(dist, "_redirects"));
  for (const { path, pages } of broken) console.error(`${path}: no such page or file, named by ${pages.join(", ")}`);
  for (const path of live) console.error(`${path}: redirected in _redirects, but the site still has this page`);
  for (const path of unused) console.error(`${path}: unused docs-media file, referenced by no built page`);
  if (broken.length || live.length || unused.length) process.exit(1);
  console.log(`Shipped ${shipped} referenced files and the redirects; every local link, image and redirect resolves.`);
}
