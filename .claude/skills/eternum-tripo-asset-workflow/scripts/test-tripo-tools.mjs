#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { normalizeSpec, readJson, recordProviderOutput, sha256File, writeJsonAtomic } from "./tripo-run-lib.mjs";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const VIEW_ROLES = ["front", "back", "left", "right"];

async function main() {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "eternum-tripo-tools-"));
  try {
    const sourceDirectory = path.join(temporaryRoot, "source");
    const packetDirectory = path.join(sourceDirectory, "generation", "input", "imagegen", "test-packet");
    await mkdir(packetDirectory, { recursive: true });
    for (const role of VIEW_ROLES) {
      await writeFile(path.join(packetDirectory, `${role}.png`), TINY_PNG);
    }
    const imagegenSpecPath = path.join(packetDirectory, "imagegen-packet-spec.json");
    await writeJsonAtomic(imagegenSpecPath, {
      schemaVersion: 1,
      assetId: "test-prop",
      packetId: "test-packet",
      sourceDescription: "A small test prop.",
      artDirectionBrief: "A consistent four-view test fixture.",
      generation: {
        tool: "Codex built-in image_gen",
        mode: "built-in",
        model: null,
        seed: null,
        unavailableFields: ["model", "seed"],
      },
      approval: {
        approved: true,
        consistencyAccepted: true,
        approvedBy: "automated-test",
        approvedAt: "2026-09-20",
      },
      views: VIEW_ROLES.map((role, index) => ({
        role,
        path: `${role}.png`,
        generatedAt: "2026-09-20T00:00:00.000Z",
        referenceRoles: VIEW_ROLES.slice(0, index),
        prompt: `Exact ${role} test prompt`,
      })),
    });
    const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
    const imagegenManifestPath = path.join(packetDirectory, "manifest.json");
    const recordImagegen = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, "record-imagegen-packet.mjs"),
        "--spec",
        imagegenSpecPath,
        "--output",
        imagegenManifestPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(recordImagegen.status, 0, recordImagegen.stderr);
    const imagegenManifest = await readJson(imagegenManifestPath);
    assert.equal(imagegenManifest.status, "approved");
    assert.deepEqual(
      imagegenManifest.views.map(({ role }) => role),
      VIEW_ROLES,
    );

    const specPath = path.join(sourceDirectory, "tripo-run-spec.json");
    const tripoSpec = {
      schemaVersion: 1,
      assetId: "test-prop",
      runId: "test-run",
      provider: "Tripo",
      approval: {
        providerAuthorized: true,
        inputPacketApproved: true,
        approvedBy: "automated-test",
        approvedAt: "2026-09-20",
        candidateCap: 1,
        creditCap: 30,
      },
      terms: {
        url: "https://www.tripo3d.ai/terms",
        retrievedAt: "2026-09-20",
        accountClass: "paid",
      },
      request: {
        model: "tripo-p1",
        scenario: "game-mobile",
        candidates: 1,
        seed: 12345,
        params: {
          face_limit: 3000,
          texture: true,
          pbr: true,
          texture_quality: "standard",
          texture_seed: 67890,
          auto_size: true,
        },
      },
      animation: {
        required: false,
        assetClass: "static",
        rigType: null,
        canonicalSkeleton: null,
        bindPose: null,
        rootMotion: null,
        requiredSockets: [],
        requiredClips: [],
        tripoDiagnostic: {
          runRigCheck: false,
          allowRigTask: false,
          allowRetarget: false,
          retargetPresets: [],
          creditCap: 0,
        },
      },
      inputs: VIEW_ROLES.map((role) => ({
        role,
        path: `generation/input/imagegen/test-packet/${role}.png`,
        creator: "Codex built-in ImageGen from an automated test brief",
        license: "test-fixture",
        provenance: {
          kind: "openai-imagegen",
          manifest: "generation/input/imagegen/test-packet/manifest.json",
        },
      })),
    };
    assert.throws(
      () =>
        normalizeSpec(
          {
            ...tripoSpec,
            terms: {
              ...tripoSpec.terms,
              accountClass: "free-evaluation",
              evaluationOnlyAcknowledged: false,
            },
          },
          specPath,
        ),
      /evaluationOnlyAcknowledged/,
    );
    const evaluationSpec = normalizeSpec(
      {
        ...tripoSpec,
        terms: {
          ...tripoSpec.terms,
          accountClass: "free-evaluation",
          evaluationOnlyAcknowledged: true,
        },
      },
      specPath,
    );
    assert.equal(evaluationSpec.terms.accountClass, "free-evaluation");
    assert.throws(
      () =>
        normalizeSpec(
          {
            ...tripoSpec,
            animation: {
              required: true,
              assetClass: "troop",
              canonicalSkeleton: "Eternum canonical humanoid v1",
              bindPose: "A-pose",
              rootMotion: "procedural",
              requiredSockets: ["weapon_right"],
              requiredClips: ["idle", "walk"],
            },
          },
          specPath,
        ),
      /animation.rigType/,
    );
    const riggedSpec = normalizeSpec(
      {
        ...tripoSpec,
        animation: {
          required: true,
          assetClass: "troop",
          rigType: "biped",
          canonicalSkeleton: "Eternum canonical humanoid v1",
          bindPose: "A-pose",
          rootMotion: "procedural",
          requiredSockets: ["weapon_right", "offhand_left"],
          requiredClips: ["idle", "walk", "attack", "hurt", "death"],
          tripoDiagnostic: {
            runRigCheck: true,
            allowRigTask: true,
            allowRetarget: true,
            retargetPresets: ["preset:idle", "preset:walk"],
            creditCap: 45,
          },
        },
      },
      specPath,
    );
    assert.equal(riggedSpec.animation.rigType, "biped");
    assert.equal(riggedSpec.animation.rootMotion, "procedural");
    assert.deepEqual(riggedSpec.animation.tripoDiagnostic.retargetPresets, ["preset:idle", "preset:walk"]);
    await writeJsonAtomic(specPath, tripoSpec);

    const runDirectory = path.join(sourceDirectory, "generation", "tripo", "test-run");
    const prepareScript = path.join(scriptsDirectory, "prepare-tripo-run.mjs");
    const prepare = spawnSync(process.execPath, [prepareScript, "--spec", specPath, "--run-dir", runDirectory], {
      encoding: "utf8",
    });
    assert.equal(
      prepare.status,
      0,
      JSON.stringify({
        status: prepare.status,
        stdout: prepare.stdout,
        stderr: prepare.stderr,
        error: prepare.error?.message,
      }),
    );
    const prepareResult = JSON.parse(prepare.stdout.trim());
    assert.equal(prepareResult.status, "prepared");

    const request = await readJson(path.join(runDirectory, "request.json"));
    const manifest = await readJson(path.join(runDirectory, "manifest.json"));
    assert.equal(request.wireModel, "P1-20260311");
    assert.equal(request.dryRun.valid, true);
    assert.equal(manifest.inputs.length, 4);
    assert.equal(manifest.animation.required, false);
    assert.equal(manifest.inputs[0].sha256, await sha256File(path.join(runDirectory, manifest.inputs[0].frozenPath)));
    assert.equal(manifest.inputs[0].provenance.packetId, "test-packet");

    // New workflow: top is approved and hashed, never submitted as a horizontal role.
    const modernPacket = await readJson(imagegenSpecPath);
    modernPacket.schemaVersion = 2;
    modernPacket.views[3] = { ...modernPacket.views[3], role: "top", path: "top.png" };
    await writeFile(path.join(packetDirectory, "top.png"), TINY_PNG);
    await writeJsonAtomic(imagegenSpecPath, modernPacket);
    const modernManifestPath = path.join(packetDirectory, "manifest-v2.json");
    const recordV2 = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, "record-imagegen-packet.mjs"),
        "--spec",
        imagegenSpecPath,
        "--output",
        modernManifestPath,
      ],
      { encoding: "utf8" },
    );
    assert.equal(recordV2.status, 0, recordV2.stderr);
    const modern = {
      ...tripoSpec,
      schemaVersion: 2,
      runId: "detailed-source",
      approval: { ...tripoSpec.approval, candidateCap: 12 },
      request: {
        model: "tripo-v3.1",
        qualityIntent: "detailed-source-master",
        candidates: 1,
        seed: 123,
        params: {
          geometry_quality: "detailed",
          texture: true,
          pbr: true,
          texture_quality: "extreme",
          texture_seed: 456,
          auto_size: false,
        },
      },
      animation: {
        required: true,
        assetClass: "troop",
        rigType: "biped",
        rigStatus: "pending",
        canonicalSkeleton: null,
        bindPose: "A-pose",
        rootMotion: "procedural",
        requiredSockets: ["primary"],
        requiredClips: [],
      },
      inputs: tripoSpec.inputs.slice(0, 3).map((input) => ({
        ...input,
        provenance: { ...input.provenance, manifest: "generation/input/imagegen/test-packet/manifest-v2.json" },
      })),
    };
    assert.equal(normalizeSpec(modern, specPath).animation.rigStatus, "pending");
    assert.throws(() => normalizeSpec({ ...modern, inputs: [{ ...modern.inputs[0], role: "top" }] }, specPath), /role/);
    assert.throws(
      () => normalizeSpec({ ...modern, request: { ...modern.request, candidates: 5 } }, specPath),
      /per-call/,
    );
    assert.throws(
      () =>
        normalizeSpec(
          { ...modern, request: { ...modern.request, params: { ...modern.request.params, face_limit: 12000 } } },
          specPath,
        ),
      /sourceConstraintReason/,
    );
    await writeJsonAtomic(specPath, modern);
    const modernRun = path.join(sourceDirectory, "generation", "tripo", modern.runId);
    const modernPrepare = spawnSync(process.execPath, [prepareScript, "--spec", specPath, "--run-dir", modernRun], {
      encoding: "utf8",
    });
    assert.equal(modernPrepare.status, 0, modernPrepare.stderr);
    const modernRequest = await readJson(path.join(modernRun, "request.json"));
    assert.equal(modernRequest.wireModel, "v3.1-20260211");
    assert.equal(modernRequest.dryRun.steps.length, 1);
    assert.equal(modernRequest.dryRun.steps[0].payload.face_limit, undefined);
    assert.equal(modernRequest.dryRun.steps[0].payload.texture_quality, "extreme");
    assert.equal(
      modernRequest.command.argv.some((arg) => arg.includes("top.png")),
      false,
    );
    // A single approved component reference works without an invented finished skeleton.
    const single = { ...modern, runId: "single-component", inputs: modern.inputs.slice(0, 1) };
    await writeJsonAtomic(specPath, single);
    const singleRun = path.join(sourceDirectory, "generation", "tripo", single.runId);
    const singlePrepare = spawnSync(process.execPath, [prepareScript, "--spec", specPath, "--run-dir", singleRun], {
      encoding: "utf8",
    });
    assert.equal(singlePrepare.status, 0, singlePrepare.stderr);
    const rightSubset = {
      ...modern,
      runId: "right-profile",
      inputs: [modern.inputs[0], modern.inputs[1], { ...tripoSpec.inputs[3] }],
    };
    await writeJsonAtomic(specPath, rightSubset);
    const rightRun = path.join(sourceDirectory, "generation", "tripo", rightSubset.runId);
    const rightPrepare = spawnSync(process.execPath, [prepareScript, "--spec", specPath, "--run-dir", rightRun], {
      encoding: "utf8",
    });
    assert.equal(rightPrepare.status, 0, rightPrepare.stderr);
    const rightRequest = await readJson(path.join(rightRun, "request.json"));
    assert.deepEqual(rightRequest.dryRun.steps[0].payload.inputs, [
      { front: "<upload:input/front.png>" },
      { back: "<upload:input/back.png>" },
      { right: "<upload:input/right.png>" },
    ]);
    // An isolated part has its own approved file, linked to the original four-view design.
    const componentDir = path.join(sourceDirectory, "generation", "input", "imagegen", "test-head");
    await mkdir(componentDir);
    await writeFile(path.join(componentDir, "front.png"), TINY_PNG);
    const componentSpecPath = path.join(componentDir, "imagegen-packet-spec.json");
    await writeJsonAtomic(componentSpecPath, {
      ...modernPacket,
      packetId: "test-head",
      packetKind: "component",
      designReference: { manifest: "../test-packet/manifest-v2.json" },
      approval: {
        ...modernPacket.approval,
        basis: "Original design approved; unchanged component inspection delegated",
      },
      views: [modernPacket.views[0]],
    });
    const componentRecord = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, "record-imagegen-packet.mjs"),
        "--spec",
        componentSpecPath,
        "--output",
        path.join(componentDir, "manifest.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(componentRecord.status, 0, componentRecord.stderr);
    const component = {
      ...modern,
      runId: "isolated-head",
      inputs: [
        {
          ...modern.inputs[0],
          path: "generation/input/imagegen/test-head/front.png",
          provenance: { kind: "openai-imagegen", manifest: "generation/input/imagegen/test-head/manifest.json" },
        },
      ],
    };
    await writeJsonAtomic(specPath, component);
    const componentPrepare = spawnSync(
      process.execPath,
      [
        prepareScript,
        "--spec",
        specPath,
        "--run-dir",
        path.join(sourceDirectory, "generation", "tripo", component.runId),
      ],
      { encoding: "utf8" },
    );
    assert.equal(componentPrepare.status, 0, componentPrepare.stderr);
    const nestedDirectory = path.join(componentDir, "nested");
    await mkdir(nestedDirectory);
    const nestedRecord = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, "record-imagegen-packet.mjs"),
        "--spec",
        componentSpecPath,
        "--output",
        path.join(nestedDirectory, "manifest.json"),
      ],
      { encoding: "utf8" },
    );
    assert.equal(nestedRecord.status, 0, nestedRecord.stderr);
    const nestedManifest = await readJson(path.join(nestedDirectory, "manifest.json"));
    assert.equal(path.resolve(nestedDirectory, nestedManifest.designReference.manifest), modernManifestPath);
    const nestedRun = {
      ...component,
      runId: "nested-component",
      inputs: [
        {
          ...component.inputs[0],
          provenance: { kind: "openai-imagegen", manifest: "generation/input/imagegen/test-head/nested/manifest.json" },
        },
      ],
    };
    await writeJsonAtomic(specPath, nestedRun);
    const nestedPrepare = spawnSync(
      process.execPath,
      [
        prepareScript,
        "--spec",
        specPath,
        "--run-dir",
        path.join(sourceDirectory, "generation", "tripo", nestedRun.runId),
      ],
      { encoding: "utf8" },
    );
    assert.equal(nestedPrepare.status, 0, nestedPrepare.stderr);
    const componentSpec = await readJson(componentSpecPath);
    await writeJsonAtomic(componentSpecPath, { ...componentSpec, designReference: { manifest: "manifest.json" } });
    const indirectRecord = spawnSync(
      process.execPath,
      [
        path.join(scriptsDirectory, "record-imagegen-packet.mjs"),
        "--spec",
        componentSpecPath,
        "--output",
        path.join(componentDir, "indirect.json"),
      ],
      { encoding: "utf8" },
    );
    assert.notEqual(indirectRecord.status, 0);
    assert.match(indirectRecord.stderr, /directly reference the full approved concept/);
    // Tampering with top still invalidates the concept even though it is not uploaded.
    await writeFile(path.join(packetDirectory, "top.png"), Buffer.from("changed top"));
    const tamper = { ...modern, runId: "tampered-top" };
    await writeJsonAtomic(specPath, tamper);
    const tamperPrepare = spawnSync(
      process.execPath,
      [prepareScript, "--spec", specPath, "--run-dir", path.join(sourceDirectory, "generation", "tripo", tamper.runId)],
      { encoding: "utf8" },
    );
    assert.notEqual(tamperPrepare.status, 0);
    assert.match(tamperPrepare.stderr, /top hash changed/);

    const providerDirectory = path.join(runDirectory, "provider", "candidate-test");
    await mkdir(providerDirectory, { recursive: true });
    await writeFile(path.join(providerDirectory, "model.glb"), Buffer.from("test-glb"));
    await writeFile(path.join(providerDirectory, "preview.png"), TINY_PNG);
    await writeJsonAtomic(path.join(providerDirectory, "task.json"), {
      task_id: "task_test",
      status: "success",
    });
    const recorded = await recordProviderOutput({
      runDirectory,
      result: {
        task_id: "task_test",
        type: "multiview_to_model",
        status: "success",
        credits_consumed: 20,
        output_dir: "provider/candidate-test",
        files: ["model.glb", "preview.png", "task.json"],
      },
      balanceAfter: { balance: 980, frozen: 0 },
    });
    assert.equal(recorded.status, "provider-output-recorded");
    assert.deepEqual(recorded.execution.taskIds, ["task_test"]);
    assert.equal(recorded.execution.artifacts.length, 3);
    assert.equal(recorded.execution.creditsConsumed, 20);

    const resultText = await readFile(path.join(runDirectory, "provider-result.json"), "utf8");
    assert.match(resultText, /task_test/);
    process.stdout.write("Tripo workflow tools: all tests passed\n");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
