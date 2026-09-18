import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateIconOutputContract } from "./icon-image.mjs";

const GAME_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REPOSITORY_DIRECTORY = resolve(GAME_DIRECTORY, "../..");
export const APPROVED_MENU_ICON_DIRECTORY = join(GAME_DIRECTORY, "asset-sources/icons/menus/approved");
export const STAGED_MENU_ICON_DIRECTORY = join(REPOSITORY_DIRECTORY, ".context/icon-generation/build/menus");
export const PUBLISHED_MENU_ICON_DIRECTORY = join(GAME_DIRECTORY, "public/image-icons");

const MENU_ICON_MANIFEST_PATH = join(GAME_DIRECTORY, "asset-sources/icons/menus/manifest.json");

export async function loadMenuIconManifest() {
  const manifest = JSON.parse(await readFile(MENU_ICON_MANIFEST_PATH, "utf8"));
  validateMenuIconManifest(manifest);
  return manifest;
}

function validateMenuIconManifest(manifest) {
  if (manifest?.version !== 1) throw new Error("menu icon manifest version must be 1");
  validateIconOutputContract(manifest?.output);
  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0)
    throw new Error("menu icons must be a non-empty array");

  const slugs = new Set();
  const targets = new Set();
  for (const icon of manifest.icons) {
    requireNonEmptyString(icon.slug, "icon.slug");
    requireNonEmptyString(icon.name, "icon.name");
    requireNonEmptyString(icon.target, "icon.target");
    requireNonEmptyString(icon.subject, "icon.subject");
    requireNonEmptyString(icon.accent, "icon.accent");
    if (!Array.isArray(icon.consumers) || icon.consumers.length === 0) {
      throw new Error(`${icon.slug} must name at least one consumer`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(icon.slug)) throw new Error(`invalid menu icon slug ${icon.slug}`);
    if (!/^[a-z0-9-]+\.png$/u.test(icon.target)) throw new Error(`invalid menu icon target ${icon.target}`);
    requireUnique(slugs, icon.slug, `duplicate menu icon slug ${icon.slug}`);
    requireUnique(targets, icon.target, `duplicate menu icon target ${icon.target}`);
  }
}

function requireUnique(values, value, message) {
  if (values.has(value)) throw new Error(message);
  values.add(value);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} must be a non-empty string`);
}
