#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  encodeParam,
  validateOriginalConcept,
  normalizeSpec,
  parseFlags,
  readJson,
  requireFlag,
  sha256File,
  writeJsonAtomic,
} from "./tripo-run-lib.mjs";

const ROLE_ORDER = ["front", "left", "back", "right"];
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const specPath = path.resolve(requireFlag(flags, "--spec"));
  const runDirectory = path.resolve(requireFlag(flags, "--run-dir"));
  const tripoBinary = flags.get("--tripo") ?? "tripo";
  const rawSpec = await readJson(specPath);
  const spec = normalizeSpec(rawSpec, specPath);

  if (path.basename(runDirectory) !== spec.runId) {
    throw new Error("The run directory basename must match spec.runId");
  }
  try {
    await stat(runDirectory);
    throw new Error(`Run directory already exists; refusing to overwrite it: ${runDirectory}`);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(path.dirname(runDirectory), { recursive: true });
  const temporaryDirectory = await mkdtemp(path.join(path.dirname(runDirectory), `.${spec.runId}-prepare-`));

  try {
    const inputDirectory = path.join(temporaryDirectory, "input");
    await mkdir(inputDirectory);
    const frozenInputs = [];
    const provenanceCache = new Map();

    for (const input of spec.inputs.sort(
      (left, right) => ROLE_ORDER.indexOf(left.role) - ROLE_ORDER.indexOf(right.role),
    )) {
      const extension = path.extname(input.sourcePath).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        throw new Error(`Unsupported image extension for ${input.role}: ${extension || "(none)"}`);
      }
      const sourceDetails = await stat(input.sourcePath);
      if (!sourceDetails.isFile() || sourceDetails.size === 0) {
        throw new Error(`Input is missing or empty: ${input.sourcePath}`);
      }
      const frozenRelativePath = `input/${input.role}${extension}`;
      const frozenPath = path.join(temporaryDirectory, frozenRelativePath);
      await copyFile(input.sourcePath, frozenPath);
      const sourceHash = await sha256File(input.sourcePath);
      const frozenHash = await sha256File(frozenPath);
      if (sourceHash !== frozenHash) {
        throw new Error(`Hash mismatch while freezing ${input.role}`);
      }
      let provenance = null;
      if (input.provenance) {
        let provenanceRecord = provenanceCache.get(input.provenance.manifestPath);
        if (!provenanceRecord) {
          const provenanceManifest = await readJson(input.provenance.manifestPath);
          if (
            provenanceManifest.status !== "approved" ||
            provenanceManifest.approval?.approved !== true ||
            provenanceManifest.approval?.consistencyAccepted !== true
          ) {
            throw new Error(`ImageGen manifest is not approved: ${input.provenance.manifestPath}`);
          }
          if (provenanceManifest.designReference) {
            const parentPath = path.resolve(
              path.dirname(input.provenance.manifestPath),
              provenanceManifest.designReference.manifest,
            );
            if ((await sha256File(parentPath)) !== provenanceManifest.designReference.sha256) {
              throw new Error("Component's approved design manifest changed");
            }
            const parent = await readJson(parentPath);
            validateOriginalConcept(parent);
            for (const view of parent.views ?? []) {
              if ((await sha256File(path.resolve(path.dirname(parentPath), view.path))) !== view.sha256) {
                throw new Error(`Component's original ${view.role} concept image changed`);
              }
            }
          }
          // Validate the whole approved packet, including the top review image not sent to Tripo.
          for (const view of provenanceManifest.views ?? []) {
            const imagePath = path.resolve(path.dirname(input.provenance.manifestPath), view.path);
            if ((await sha256File(imagePath)) !== view.sha256) {
              throw new Error(`Approved packet ${view.role} hash changed: ${imagePath}`);
            }
          }
          provenanceRecord = {
            manifest: provenanceManifest,
            sha256: await sha256File(input.provenance.manifestPath),
          };
          provenanceCache.set(input.provenance.manifestPath, provenanceRecord);
        }
        const provenanceView = provenanceRecord.manifest.views?.find((view) => view.role === input.role);
        if (!provenanceView) {
          throw new Error(`ImageGen manifest has no ${input.role} view: ${input.provenance.manifestPath}`);
        }
        const recordedImagePath = path.resolve(path.dirname(input.provenance.manifestPath), provenanceView.path);
        if (recordedImagePath !== input.sourcePath) {
          throw new Error(`ImageGen ${input.role} path does not match its approved manifest`);
        }
        if (provenanceView.sha256 !== sourceHash) {
          throw new Error(`ImageGen ${input.role} hash does not match its approved manifest`);
        }
        provenance = {
          kind: input.provenance.kind,
          manifest: input.provenance.manifest,
          manifestSha256: provenanceRecord.sha256,
          packetId: provenanceRecord.manifest.packetId,
        };
      }
      frozenInputs.push({
        role: input.role,
        originalPath: input.path,
        frozenPath: frozenRelativePath,
        creator: input.creator,
        license: input.license,
        bytes: sourceDetails.size,
        sha256: frozenHash,
        provenance,
      });
    }

    const commandArguments = ["make", ...frozenInputs.map((input) => input.frozenPath)];
    if (spec.request.scenario) {
      commandArguments.push("--for", spec.request.scenario);
    }
    commandArguments.push(
      "--model",
      spec.request.model,
      "--candidates",
      String(spec.request.candidates),
      "--seed",
      String(spec.request.seed),
    );
    for (const [name, value] of Object.entries(spec.request.params).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      commandArguments.push("--param", `${name}=${encodeParam(value)}`);
    }
    commandArguments.push("--out", "provider", "--json", "--yes", "--no-open");

    const versionResult = spawnSync(tripoBinary, ["--version"], { encoding: "utf8" });
    if (versionResult.status !== 0) {
      throw new Error(
        `Unable to execute ${tripoBinary}: ${versionResult.error?.message ?? versionResult.stderr?.trim() ?? "unknown error"}`,
      );
    }
    const dryRunResult = spawnSync(tripoBinary, [...commandArguments, "--dry-run"], {
      cwd: temporaryDirectory,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    if (dryRunResult.status !== 0) {
      throw new Error(
        `Tripo dry run failed with exit ${dryRunResult.status}: ${dryRunResult.error?.message ?? dryRunResult.stderr?.trim() ?? dryRunResult.stdout?.trim() ?? "unknown error"}`,
      );
    }
    let dryRun;
    try {
      dryRun = JSON.parse(dryRunResult.stdout.trim());
    } catch (error) {
      throw new Error(`Tripo dry run returned invalid JSON: ${error.message}`);
    }
    if (dryRun.valid !== true || (dryRun.errors?.length ?? 0) > 0) {
      throw new Error(`Tripo rejected the prepared plan: ${JSON.stringify(dryRun.errors ?? [])}`);
    }
    if (dryRun.model !== spec.request.wireModel) {
      throw new Error(`Model mismatch: spec expected ${spec.request.wireModel}, but the CLI planned ${dryRun.model}`);
    }

    if (spec.schemaVersion === 2) {
      const generation = dryRun.steps?.find((step) => step.payload?.model === spec.request.wireModel);
      if (!generation) throw new Error("Dry run has no matching generation payload");
      if (frozenInputs.length > 1) {
        const actual = generation.payload.inputs;
        for (const input of frozenInputs) {
          if (
            !Array.isArray(actual) ||
            !actual.some(
              (view) => Object.keys(view).length === 1 && view[input.role] === `<upload:${input.frozenPath}>`,
            )
          ) {
            throw new Error(`Dry run changed horizontal view mapping: ${input.role}`);
          }
        }
        if (actual.length !== frozenInputs.length) throw new Error("Dry run introduced extra image views");
      }
      for (const [key, value] of Object.entries(spec.request.params)) {
        if (JSON.stringify(generation.payload[key]) !== JSON.stringify(value)) {
          throw new Error(`Dry run changed or stripped requested parameter: ${key}`);
        }
      }
      if (spec.request.params.face_limit === undefined && generation.payload.face_limit !== undefined) {
        throw new Error("Dry run introduced an unrequested source face limit");
      }
      if (dryRun.steps.length !== 1) throw new Error("Geometry-source v2 run must not add implicit processing tasks");
    }

    const normalizedSpec = {
      ...rawSpec,
      animation: spec.animation,
      request: {
        ...rawSpec.request,
        wireModel: spec.request.wireModel,
      },
    };
    await writeJsonAtomic(path.join(temporaryDirectory, "spec.json"), normalizedSpec);

    const request = {
      schemaVersion: 1,
      provider: "Tripo",
      assetId: spec.assetId,
      runId: spec.runId,
      cliVersion: versionResult.stdout.trim(),
      modelAlias: spec.request.model,
      wireModel: spec.request.wireModel,
      command: {
        cwd: ".",
        executable: tripoBinary,
        argv: commandArguments,
      },
      dryRun,
    };
    const requestPath = path.join(temporaryDirectory, "request.json");
    await writeJsonAtomic(requestPath, request);
    const preparedAt = new Date().toISOString();
    const manifest = {
      schemaVersion: 1,
      assetId: spec.assetId,
      runId: spec.runId,
      status: "prepared",
      createdAt: preparedAt,
      updatedAt: preparedAt,
      provider: {
        name: "Tripo",
        cliVersion: request.cliVersion,
        modelAlias: spec.request.model,
        wireModel: spec.request.wireModel,
        terms: spec.terms,
        useRestriction:
          spec.terms.accountClass === "paid"
            ? "production-source-eligible-subject-to-all-workflow-gates"
            : "evaluation-only-not-for-promotion-or-shipping",
      },
      approval: spec.approval,
      animation: spec.animation,
      inputs: frozenInputs,
      request: {
        path: "request.json",
        sha256: await sha256File(requestPath),
        warnings: dryRun.warnings ?? [],
      },
      execution: {
        status: "not-started",
        creditsConsumed: null,
        taskIds: [],
        artifacts: [],
      },
      lineage: {
        selectedProviderArtifact: null,
        blenderSource: null,
        productionGlb: null,
      },
    };
    await writeJsonAtomic(path.join(temporaryDirectory, "manifest.json"), manifest);
    await rename(temporaryDirectory, runDirectory);

    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        status: "prepared",
        runDirectory,
        request: path.join(runDirectory, "request.json"),
        manifest: path.join(runDirectory, "manifest.json"),
        warnings: manifest.request.warnings,
      })}\n`,
    );
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`prepare-tripo-run: ${error.message}\n`);
  process.exitCode = 1;
});
