import { createHash } from "node:crypto";
import { readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL_WIRE_VERSIONS = Object.freeze({
  "tripo-p1": "P1-20260311",
  "tripo-p2": "P2-20260801",
  "tripo-v3.1": "v3.1-20260211",
});

const RIG_TYPES = new Set(["biped", "quadruped", "hexapod", "octopod", "avian", "serpentine", "aquatic"]);
const ROOT_MOTION_POLICIES = new Set(["in-place", "moving-root", "procedural"]);

export function parseFlags(argv) {
  const flags = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!name.startsWith("--")) {
      throw new Error(`Unexpected argument: ${name}`);
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }

    if (flags.has(name)) {
      throw new Error(`Duplicate flag: ${name}`);
    }

    flags.set(name, value);
    index += 1;
  }

  return flags;
}

export function requireFlag(flags, name) {
  const value = flags.get(name);
  if (!value) {
    throw new Error(`Required flag missing: ${name}`);
  }
  return value;
}

export async function readJson(filePath) {
  const source = await readFile(filePath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

export async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, filePath);
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertIsoDate(value, label) {
  assertNonEmptyString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid YYYY-MM-DD date`);
  }
}

function asPositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function asNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function asStringArray(value, label, { minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new Error(`${label} must contain between ${minimum} and ${maximum} strings`);
  }
  value.forEach((item, index) => assertNonEmptyString(item, `${label}[${index}]`));
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} must not contain duplicates`);
  }
  return [...value];
}

function normalizeAnimation(animation = {}, schemaVersion = 1) {
  if (!animation || typeof animation !== "object" || Array.isArray(animation)) {
    throw new Error("animation must be an object");
  }
  if (animation.required !== undefined && typeof animation.required !== "boolean") {
    throw new Error("animation.required must be a boolean");
  }

  const required = animation.required === true;
  const assetClass = animation.assetClass ?? (required ? null : "static");
  assertNonEmptyString(assetClass, "animation.assetClass");

  const diagnostic = animation.tripoDiagnostic ?? {};
  if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) {
    throw new Error("animation.tripoDiagnostic must be an object");
  }
  for (const name of ["runRigCheck", "allowRigTask", "allowRetarget"]) {
    if (diagnostic[name] !== undefined && typeof diagnostic[name] !== "boolean") {
      throw new Error(`animation.tripoDiagnostic.${name} must be a boolean`);
    }
  }
  const runRigCheck = diagnostic.runRigCheck === true;
  const allowRigTask = diagnostic.allowRigTask === true;
  const allowRetarget = diagnostic.allowRetarget === true;
  const retargetPresets = asStringArray(diagnostic.retargetPresets ?? [], "animation.tripoDiagnostic.retargetPresets", {
    maximum: 5,
  });
  const creditCap = asNonNegativeInteger(diagnostic.creditCap ?? 0, "animation.tripoDiagnostic.creditCap");

  if (allowRigTask && !runRigCheck) {
    throw new Error("animation.tripoDiagnostic.allowRigTask requires runRigCheck");
  }
  if (allowRetarget && !allowRigTask) {
    throw new Error("animation.tripoDiagnostic.allowRetarget requires allowRigTask");
  }
  if (allowRetarget && retargetPresets.length === 0) {
    throw new Error("animation.tripoDiagnostic.retargetPresets is required when retargeting is allowed");
  }
  if (!allowRetarget && retargetPresets.length > 0) {
    throw new Error("animation.tripoDiagnostic.retargetPresets requires allowRetarget");
  }
  if ((allowRigTask || allowRetarget) && creditCap === 0) {
    throw new Error("animation.tripoDiagnostic.creditCap must be greater than zero for paid rig or retarget tasks");
  }

  const normalizedDiagnostic = {
    runRigCheck,
    allowRigTask,
    allowRetarget,
    retargetPresets,
    creditCap,
  };

  if (!required) {
    if (runRigCheck || allowRigTask || allowRetarget || retargetPresets.length > 0 || creditCap > 0) {
      throw new Error("animation.required must be true before Tripo rig diagnostics can be planned");
    }
    return {
      required: false,
      assetClass,
      rigType: null,
      canonicalSkeleton: null,
      bindPose: null,
      rootMotion: null,
      requiredSockets: [],
      requiredClips: [],
      tripoDiagnostic: normalizedDiagnostic,
    };
  }

  if (!RIG_TYPES.has(animation.rigType)) {
    throw new Error(`animation.rigType must be one of: ${[...RIG_TYPES].join(", ")}`);
  }
  const pendingRig = schemaVersion === 2 && animation.rigStatus === "pending";
  if (pendingRig) {
    if (animation.canonicalSkeleton != null) throw new Error("A pending rig must have canonicalSkeleton: null");
  } else {
    assertNonEmptyString(animation.canonicalSkeleton, "animation.canonicalSkeleton");
  }
  assertNonEmptyString(animation.bindPose, "animation.bindPose");
  if (!ROOT_MOTION_POLICIES.has(animation.rootMotion)) {
    throw new Error(`animation.rootMotion must be one of: ${[...ROOT_MOTION_POLICIES].join(", ")}`);
  }

  return {
    required: true,
    assetClass,
    rigType: animation.rigType,
    canonicalSkeleton: animation.canonicalSkeleton ?? null,
    rigStatus: pendingRig ? "pending" : "resolved",
    bindPose: animation.bindPose,
    rootMotion: animation.rootMotion,
    requiredSockets: asStringArray(animation.requiredSockets ?? [], "animation.requiredSockets"),
    requiredClips: asStringArray(animation.requiredClips ?? [], "animation.requiredClips", {
      minimum: schemaVersion === 2 ? 0 : 1,
    }),
    tripoDiagnostic: normalizedDiagnostic,
  };
}

export function normalizeSpec(spec, specPath) {
  if (![1, 2].includes(spec.schemaVersion)) {
    throw new Error("schemaVersion must be 1 or 2");
  }
  assertNonEmptyString(spec.assetId, "assetId");
  assertNonEmptyString(spec.runId, "runId");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(spec.runId)) {
    throw new Error("runId may contain only letters, numbers, dots, underscores, and hyphens");
  }
  if (spec.provider !== "Tripo") {
    throw new Error('provider must be exactly "Tripo"');
  }

  const approval = spec.approval ?? {};
  if (approval.providerAuthorized !== true) {
    throw new Error("approval.providerAuthorized must be true after explicit provider approval");
  }
  if (approval.inputPacketApproved !== true) {
    throw new Error("approval.inputPacketApproved must be true after the exact input packet is approved");
  }
  assertNonEmptyString(approval.approvedBy, "approval.approvedBy");
  assertIsoDate(approval.approvedAt, "approval.approvedAt");
  const candidateCap = asPositiveInteger(approval.candidateCap, "approval.candidateCap");
  const creditCap = asPositiveInteger(approval.creditCap, "approval.creditCap");

  const terms = spec.terms ?? {};
  assertNonEmptyString(terms.url, "terms.url");
  if (!terms.url.startsWith("https://")) {
    throw new Error("terms.url must be an https URL");
  }
  assertIsoDate(terms.retrievedAt, "terms.retrievedAt");
  if (!new Set(["paid", "free-evaluation"]).has(terms.accountClass)) {
    throw new Error('terms.accountClass must be "paid" or "free-evaluation"');
  }
  if (terms.accountClass === "free-evaluation" && terms.evaluationOnlyAcknowledged !== true) {
    throw new Error(
      "terms.evaluationOnlyAcknowledged must be true for a free-evaluation run; its outputs cannot be promoted or shipped",
    );
  }

  const request = spec.request ?? {};
  const wireModel = MODEL_WIRE_VERSIONS[request.model];
  if (!wireModel) {
    throw new Error(`request.model must be one of: ${Object.keys(MODEL_WIRE_VERSIONS).join(", ")}`);
  }
  if (request.scenario !== undefined) {
    assertNonEmptyString(request.scenario, "request.scenario");
  }
  const candidates = asPositiveInteger(request.candidates, "request.candidates");
  if (candidates > 4) throw new Error("request.candidates cannot exceed the CLI per-call maximum of 4");
  if (candidates > candidateCap) {
    throw new Error("request.candidates exceeds approval.candidateCap");
  }
  if (!Number.isSafeInteger(request.seed) || request.seed < 0) {
    throw new Error("request.seed must be a non-negative integer");
  }

  const params = request.params ?? {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw new Error("request.params must be an object");
  }
  for (const [name, value] of Object.entries(params)) {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid request parameter name: ${name}`);
    }
    if (value === null || value === undefined || typeof value === "function") {
      throw new Error(`request.params.${name} has an unsupported value`);
    }
  }
  if ("model_seed" in params) {
    throw new Error("Set request.seed instead of request.params.model_seed");
  }
  const texturesEnabled = params.texture !== false || params.pbr === true;
  if (texturesEnabled && (!Number.isSafeInteger(params.texture_seed) || params.texture_seed < 0)) {
    throw new Error("request.params.texture_seed must be a non-negative integer when textures are enabled");
  }

  if (spec.schemaVersion === 2) {
    assertNonEmptyString(request.qualityIntent, "request.qualityIntent");
    if (
      request.scenario ||
      params.face_limit !== undefined ||
      params.smart_low_poly === true ||
      request.model !== "tripo-v3.1"
    ) {
      assertNonEmptyString(
        request.sourceConstraintReason,
        "request.sourceConstraintReason (explicit source quality tradeoff)",
      );
    }
  }
  if (
    !Array.isArray(spec.inputs) ||
    spec.inputs.length < (spec.schemaVersion === 2 ? 1 : 2) ||
    spec.inputs.length > 4
  ) {
    throw new Error("inputs must contain one to four horizontal views for v2, two to four for v1");
  }
  const allowedRoles = new Set(["front", "left", "back", "right"]);
  const seenRoles = new Set();
  const specDirectory = path.dirname(specPath);
  const inputs = spec.inputs.map((input, index) => {
    if (!input || typeof input !== "object") {
      throw new Error(`inputs[${index}] must be an object`);
    }
    if (!allowedRoles.has(input.role)) {
      throw new Error(`inputs[${index}].role must be front, left, back, or right`);
    }
    if (seenRoles.has(input.role)) {
      throw new Error(`Duplicate input role: ${input.role}`);
    }
    seenRoles.add(input.role);
    assertNonEmptyString(input.path, `inputs[${index}].path`);
    assertNonEmptyString(input.creator, `inputs[${index}].creator`);
    assertNonEmptyString(input.license, `inputs[${index}].license`);
    let provenance = null;
    if (input.provenance !== undefined) {
      if (!input.provenance || typeof input.provenance !== "object" || Array.isArray(input.provenance)) {
        throw new Error(`inputs[${index}].provenance must be an object`);
      }
      if (input.provenance.kind !== "openai-imagegen") {
        throw new Error(`inputs[${index}].provenance.kind must be "openai-imagegen"`);
      }
      assertNonEmptyString(input.provenance.manifest, `inputs[${index}].provenance.manifest`);
      provenance = {
        kind: input.provenance.kind,
        manifest: input.provenance.manifest,
        manifestPath: path.resolve(specDirectory, input.provenance.manifest),
      };
    }
    return {
      ...input,
      sourcePath: path.resolve(specDirectory, input.path),
      provenance,
    };
  });
  if (!seenRoles.has("front")) {
    throw new Error("inputs must contain a front view");
  }

  const animation = normalizeAnimation(spec.animation, spec.schemaVersion);

  return {
    ...spec,
    approval: { ...approval, candidateCap, creditCap },
    terms,
    request: { ...request, candidates, params, wireModel },
    inputs,
    animation,
  };
}

export function validateOriginalConcept(manifest) {
  const roles = new Set(manifest.views?.map((view) => view.role));
  if (
    ![1, 2].includes(manifest.schemaVersion) ||
    manifest.packetKind === "component" ||
    manifest.status !== "approved" ||
    manifest.approval?.approved !== true ||
    manifest.approval?.consistencyAccepted !== true ||
    !roles.has("front") ||
    !roles.has("back") ||
    !(roles.has("left") || roles.has("right")) ||
    (manifest.schemaVersion === 2 ? !roles.has("top") : !(roles.has("left") && roles.has("right")))
  ) {
    throw new Error("Component must directly reference the full approved concept packet, not another component");
  }
}

export function encodeParam(value) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

async function collectArtifacts(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const artifacts = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      artifacts.push(...(await collectArtifacts(absolutePath, baseDirectory)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const details = await stat(absolutePath);
    artifacts.push({
      path: path.relative(baseDirectory, absolutePath).split(path.sep).join("/"),
      bytes: details.size,
      sha256: await sha256File(absolutePath),
    });
  }

  return artifacts;
}

function extractTaskIds(result) {
  const ids = new Set();
  if (typeof result.task_id === "string") {
    ids.add(result.task_id);
  }
  if (typeof result.source_task_id === "string") {
    ids.add(result.source_task_id);
  }
  for (const item of [...(result.credits_breakdown ?? []), ...(result.chain ?? [])]) {
    if (item && typeof item.task_id === "string") {
      ids.add(item.task_id);
    }
  }
  return [...ids];
}

export async function recordProviderOutput({ runDirectory, result, balanceAfter = null }) {
  const manifestPath = path.join(runDirectory, "manifest.json");
  const resultPath = path.join(runDirectory, "provider-result.json");
  const providerDirectory = path.join(runDirectory, "provider");
  const manifest = await readJson(manifestPath);
  const creditsConsumed = Number(result.credits_consumed ?? 0);
  if (!Number.isFinite(creditsConsumed) || creditsConsumed < 0) {
    throw new Error("provider result has an invalid credits_consumed value");
  }

  await writeJsonAtomic(resultPath, result);
  const artifacts = await collectArtifacts(providerDirectory, runDirectory);
  const resultHash = await sha256File(resultPath);
  const capExceeded = creditsConsumed > manifest.approval.creditCap;
  const providerSucceeded = result.status === "success";
  const completedAt = new Date().toISOString();

  manifest.status = providerSucceeded
    ? capExceeded
      ? "credit-cap-exceeded"
      : "provider-output-recorded"
    : "provider-output-needs-recovery";
  manifest.updatedAt = completedAt;
  manifest.execution = {
    ...manifest.execution,
    status: manifest.status,
    completedAt,
    creditsConsumed,
    creditCap: manifest.approval.creditCap,
    capExceeded,
    providerSucceeded,
    taskIds: extractTaskIds(result),
    balanceAfter,
    providerResult: {
      path: "provider-result.json",
      sha256: resultHash,
    },
    artifacts,
  };
  await writeJsonAtomic(manifestPath, manifest);

  if (!providerSucceeded) {
    throw new Error(`Provider result status is ${String(result.status)}; inspect and recover the task`);
  }
  if (capExceeded) {
    throw new Error(
      `Provider reported ${creditsConsumed} credits, above the approved cap of ${manifest.approval.creditCap}`,
    );
  }

  return manifest;
}
