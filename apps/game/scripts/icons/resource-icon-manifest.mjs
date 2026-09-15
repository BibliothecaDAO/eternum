import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateIconOutputContract } from "./icon-image.mjs";

const GAME_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const REPOSITORY_DIRECTORY = resolve(GAME_DIRECTORY, "../..");
const RESOURCE_ICON_MANIFEST_PATH = join(GAME_DIRECTORY, "asset-sources/icons/resources/manifest.json");
export const APPROVED_RESOURCE_ICON_DIRECTORY = join(GAME_DIRECTORY, "asset-sources/icons/resources/approved");
export const STAGED_RESOURCE_ICON_DIRECTORY = join(REPOSITORY_DIRECTORY, ".context/icon-generation/build/resources");
export const PUBLISHED_RESOURCE_ICON_DIRECTORY = join(GAME_DIRECTORY, "public/images/resources");

const RESOURCE_IDS_PATH = join(REPOSITORY_DIRECTORY, "packages/types/src/constants/resource-ids.ts");

export async function loadResourceIconManifest() {
  const [manifestSource, resourceIdsSource] = await Promise.all([
    readFile(RESOURCE_ICON_MANIFEST_PATH, "utf8"),
    readFile(RESOURCE_IDS_PATH, "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);
  validateResourceIconManifest(manifest, parseResourceIds(resourceIdsSource));
  return manifest;
}

function parseResourceIds(source) {
  return [...source.matchAll(/^\s*([A-Za-z][A-Za-z0-9]*)\s*=\s*(\d+),/gmu)].map(([, enumKey, id]) => ({
    enumKey,
    id: Number(id),
  }));
}

function validateResourceIconManifest(manifest, resourceIds) {
  requireCondition(manifest?.version === 1, "manifest version must be 1");
  validateIconOutputContract(manifest?.output);
  for (const field of ["useCase", "assetType", "style", "composition", "lighting", "palette", "constraints", "avoid"]) {
    requireNonEmptyString(manifest?.generation?.[field], `generation.${field}`);
  }
  requireCondition(Array.isArray(manifest.resources), "resources must be an array");

  const expectedByKey = new Map(resourceIds.map((resource) => [resource.enumKey, resource.id]));
  const ids = new Set();
  const enumKeys = new Set();
  const slugs = new Set();

  for (const resource of manifest.resources) {
    validateResourceDefinition(resource, expectedByKey);
    requireUnique(ids, resource.id, `duplicate resource id ${resource.id}`);
    requireUnique(enumKeys, resource.enumKey, `duplicate enum key ${resource.enumKey}`);
    requireUnique(slugs, resource.slug, `duplicate resource slug ${resource.slug}`);
  }

  const missing = resourceIds.filter(({ enumKey }) => !enumKeys.has(enumKey)).map(({ enumKey }) => enumKey);
  const unexpected = manifest.resources
    .filter(({ enumKey }) => !expectedByKey.has(enumKey))
    .map(({ enumKey }) => enumKey);
  requireCondition(missing.length === 0, `manifest is missing resource enum keys: ${missing.join(", ")}`);
  requireCondition(unexpected.length === 0, `manifest has unknown resource enum keys: ${unexpected.join(", ")}`);
  requireCondition(
    manifest.resources.length === resourceIds.length,
    `manifest has ${manifest.resources.length} resources; enum has ${resourceIds.length}`,
  );
}

export function selectResourceIcons(manifest, pilotOnly) {
  return pilotOnly ? manifest.resources.filter(({ pilot }) => pilot === true) : manifest.resources;
}

export function buildResourceIconPrompt(manifest, resource) {
  const generation = manifest.generation;
  return [
    `Use case: ${generation.useCase}`,
    `Asset type: ${generation.assetType}`,
    `Primary request: ${resource.subject}`,
    `Style/medium: ${generation.style}`,
    `Composition/framing: ${generation.composition}`,
    `Lighting/mood: ${generation.lighting}`,
    `Color palette: ${generation.palette}; ${resource.accent}`,
    resource.distinction ? `Family distinction: ${resource.distinction}` : null,
    `Constraints: ${generation.constraints}`,
    `Avoid: ${generation.avoid}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function validateResourceDefinition(resource, expectedByKey) {
  requirePositiveInteger(resource?.id, "resource.id");
  requireNonEmptyString(resource?.enumKey, "resource.enumKey");
  requireNonEmptyString(resource?.slug, "resource.slug");
  requireNonEmptyString(resource?.name, "resource.name");
  requireNonEmptyString(resource?.family, "resource.family");
  requireNonEmptyString(resource?.subject, "resource.subject");
  requireNonEmptyString(resource?.accent, "resource.accent");
  requireCondition(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(resource.slug), `invalid slug ${resource.slug}`);
  requireCondition(
    expectedByKey.get(resource.enumKey) === resource.id,
    `${resource.enumKey} must use resource id ${expectedByKey.get(resource.enumKey)}; manifest has ${resource.id}`,
  );
}

function requireUnique(values, value, message) {
  requireCondition(!values.has(value), message);
  values.add(value);
}

function requirePositiveInteger(value, label) {
  requireCondition(Number.isInteger(value) && value > 0, `${label} must be a positive integer`);
}

function requireNonEmptyString(value, label) {
  requireCondition(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}
