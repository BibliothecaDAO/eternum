#!/usr/bin/env node

import { stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  parseFlags,
  readJson,
  requireFlag,
  sha256File,
  writeJsonAtomic,
  validateOriginalConcept,
} from "./tripo-run-lib.mjs";

const EXPECTED_REFERENCES = Object.freeze({
  front: [],
  back: ["front"],
  left: ["front", "back"],
  right: ["front", "back", "left"],
});
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireIsoDate(value, label) {
  requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date`);
  }
}

function requireIsoTimestamp(value, label) {
  requireString(value, label);
  if (Number.isNaN(Date.parse(value)) || !value.includes("T")) {
    throw new Error(`${label} must be a valid ISO-8601 timestamp`);
  }
}

function isInside(parentDirectory, targetPath) {
  const relative = path.relative(parentDirectory, targetPath);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const specPath = path.resolve(requireFlag(flags, "--spec"));
  const outputPath = path.resolve(requireFlag(flags, "--output"));
  const packetDirectory = path.dirname(specPath);
  const spec = await readJson(specPath);

  if (![1, 2].includes(spec.schemaVersion)) {
    throw new Error("schemaVersion must be 1 or 2");
  }
  requireString(spec.assetId, "assetId");
  requireString(spec.packetId, "packetId");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(spec.packetId)) {
    throw new Error("packetId may contain only letters, numbers, dots, underscores, and hyphens");
  }
  requireString(spec.sourceDescription, "sourceDescription");
  requireString(spec.artDirectionBrief, "artDirectionBrief");
  if (path.basename(packetDirectory) !== spec.packetId) {
    throw new Error("The packet directory basename must match spec.packetId");
  }
  if (!isInside(packetDirectory, outputPath)) {
    throw new Error("The output manifest must be inside the packet directory");
  }

  const generation = spec.generation ?? {};
  if (generation.tool !== "Codex built-in image_gen" || generation.mode !== "built-in") {
    throw new Error('generation must use tool "Codex built-in image_gen" and mode "built-in"');
  }
  if (generation.model !== null || generation.seed !== null) {
    throw new Error("Built-in ImageGen model and seed must remain null unless the tool explicitly reports them");
  }
  if (
    !Array.isArray(generation.unavailableFields) ||
    !generation.unavailableFields.includes("model") ||
    !generation.unavailableFields.includes("seed")
  ) {
    throw new Error('generation.unavailableFields must contain "model" and "seed"');
  }

  const approval = spec.approval ?? {};
  if (approval.approved !== true || approval.consistencyAccepted !== true) {
    throw new Error("approval.approved and approval.consistencyAccepted must be true after user review");
  }
  requireString(approval.approvedBy, "approval.approvedBy");
  requireIsoDate(approval.approvedAt, "approval.approvedAt");

  const modern = spec.schemaVersion === 2;
  const component = modern && spec.packetKind === "component";
  let designReference = null;
  if (component) {
    requireString(spec.designReference?.manifest, "designReference.manifest");
    requireString(approval.basis, "approval.basis for a derived component");
    const designPath = path.resolve(packetDirectory, spec.designReference.manifest);
    const design = await readJson(designPath);
    validateOriginalConcept(design);
    for (const view of design.views ?? []) {
      if ((await sha256File(path.resolve(path.dirname(designPath), view.path))) !== view.sha256) {
        throw new Error(`Original design ${view.role} image changed`);
      }
    }
    designReference = {
      manifest: path.relative(path.dirname(outputPath), designPath).split(path.sep).join("/"),
      sha256: await sha256File(designPath),
      packetId: design.packetId,
    };
  }
  const requiredRoles = component ? ["front"] : modern ? ["front", "back", "top"] : Object.keys(EXPECTED_REFERENCES);
  const allowedRoles = modern ? ["front", "back", "left", "right", "top"] : requiredRoles;
  if (!Array.isArray(spec.views) || spec.views.length < (component ? 1 : 4) || spec.views.length > (modern ? 5 : 4)) {
    throw new Error(
      "views must contain front/back/a true side/top for v2 (opposite side optional), or four horizontal views for v1",
    );
  }
  if (modern && !component && !spec.views.some((view) => ["left", "right"].includes(view.role))) {
    throw new Error("A true left or right profile is required");
  }
  const seenRoles = new Set();
  const views = [];
  for (const view of spec.views) {
    const expectedReferences = EXPECTED_REFERENCES[view.role];
    if (!allowedRoles.includes(view.role)) {
      throw new Error(`Unsupported view role: ${String(view.role)}`);
    }
    if (seenRoles.has(view.role)) {
      throw new Error(`Duplicate view role: ${view.role}`);
    }
    seenRoles.add(view.role);
    requireString(view.path, `${view.role}.path`);
    requireString(view.prompt, `${view.role}.prompt`);
    requireIsoTimestamp(view.generatedAt, `${view.role}.generatedAt`);
    if (
      !Array.isArray(view.referenceRoles) ||
      (!modern && JSON.stringify(view.referenceRoles) !== JSON.stringify(expectedReferences)) ||
      (modern &&
        (!Array.isArray(view.referenceRoles) ||
          view.referenceRoles.some((role) => !allowedRoles.includes(role) || role === view.role)))
    ) {
      throw new Error(`${view.role}.referenceRoles must be ${JSON.stringify(expectedReferences)}`);
    }

    const imagePath = path.resolve(packetDirectory, view.path);
    if (!isInside(packetDirectory, imagePath)) {
      throw new Error(`${view.role}.path must remain inside the packet directory`);
    }
    const extension = path.extname(imagePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported image extension for ${view.role}: ${extension || "(none)"}`);
    }
    const details = await stat(imagePath);
    if (!details.isFile() || details.size === 0) {
      throw new Error(`Image is missing or empty: ${imagePath}`);
    }
    views.push({
      role: view.role,
      path: path.relative(path.dirname(outputPath), imagePath).split(path.sep).join("/"),
      generatedAt: new Date(view.generatedAt).toISOString(),
      referenceRoles: view.referenceRoles,
      prompt: view.prompt,
      bytes: details.size,
      sha256: await sha256File(imagePath),
    });
  }
  for (const role of requiredRoles) {
    if (!seenRoles.has(role)) {
      throw new Error(`Missing required view: ${role}`);
    }
  }

  try {
    await stat(outputPath);
    throw new Error(`Output manifest already exists; create a new packet instead of overwriting it: ${outputPath}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const recordedAt = new Date().toISOString();
  const manifest = {
    schemaVersion: spec.schemaVersion,
    assetId: spec.assetId,
    packetId: spec.packetId,
    packetKind: component ? "component" : "concept",
    designReference,
    status: "approved",
    recordedAt,
    sourceDescription: spec.sourceDescription,
    artDirectionBrief: spec.artDirectionBrief,
    generation,
    approval,
    sourceSpec: {
      path: path.relative(path.dirname(outputPath), specPath).split(path.sep).join("/"),
      sha256: await sha256File(specPath),
    },
    views: views.sort((left, right) => allowedRoles.indexOf(left.role) - allowedRoles.indexOf(right.role)),
  };
  await writeJsonAtomic(outputPath, manifest);
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      status: manifest.status,
      packetId: manifest.packetId,
      output: outputPath,
      views: manifest.views.map(({ role, sha256 }) => ({ role, sha256 })),
    })}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`record-imagegen-packet: ${error.message}\n`);
  process.exitCode = 1;
});
