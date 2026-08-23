// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildCharacterAnimationCaptureUrl,
  evaluateCharacterAnimationCapture,
  normalizeCaptureKind,
  normalizeCaptureMotionMode,
  normalizeCaptureOverlay,
  normalizeCaptureSampling,
  normalizeCaptureSequence,
  normalizeRootMotionSpeed,
  resolveCaptureMotionMode,
} from "./run-character-animation-capture.mjs";

describe("character animation capture script", () => {
  it("builds the auth-free gym URL with renderer selection", () => {
    expect(
      buildCharacterAnimationCaptureUrl({
        baseUrl: "https://127.0.0.1:4173",
        rendererMode: "webgpu-force-webgl",
      }),
    ).toBe("https://127.0.0.1:4173/debug/procedural-characters?rendererMode=webgpu-force-webgl");
  });

  it("validates supported capture inputs", () => {
    expect(normalizeCaptureKind("paladin")).toBe("paladin");
    expect(normalizeCaptureKind("horse")).toBe("horse");
    expect(normalizeCaptureSampling("phase-atlas")).toBe("phase-atlas");
    expect(normalizeCaptureOverlay("diagnostic")).toBe("diagnostic");
    expect(normalizeCaptureSequence("locomotion-cycle")).toBe("locomotion-cycle");
    expect(normalizeCaptureMotionMode("run")).toBe("run");
    expect(resolveCaptureMotionMode("paladin", "")).toBe("mounted");
    expect(resolveCaptureMotionMode("crossbowman", "")).toBe("walk");
    expect(normalizeRootMotionSpeed("0.72")).toBe(0.72);
    expect(() => normalizeCaptureKind("dragon")).toThrow("Unsupported capture kind");
    expect(() => normalizeCaptureOverlay("labels-everywhere")).toThrow("Unsupported capture overlay");
    expect(() => resolveCaptureMotionMode("paladin", "run")).toThrow("does not support motion mode");
    expect(() => normalizeRootMotionSpeed("backwards")).toThrow("Invalid root motion speed");
  });

  it("rejects blank or anatomically invalid captures", () => {
    expect(
      evaluateCharacterAnimationCapture({
        browserErrors: [],
        report: {
          frames: [
            {
              frameIndex: 12,
              imageNonBlank: false,
              issues: ["arrow-intersects-head"],
              views: [{ id: "rear", imageNonBlank: false }],
            },
          ],
        },
      }),
    ).toEqual({
      ok: false,
      reasons: ["blank frame views: F12:rear", "critical pose issues: F12:arrow-intersects-head"],
    });
  });

  it("accepts a complete five-view frame", () => {
    expect(
      evaluateCharacterAnimationCapture({
        browserErrors: [],
        report: {
          frames: [
            {
              frameIndex: 36,
              imageNonBlank: true,
              issues: [],
              views: ["front", "right-profile", "rear", "left-profile", "elevated-three-quarter"].map((id) => ({
                id,
                imageNonBlank: true,
              })),
            },
          ],
        },
      }),
    ).toEqual({ ok: true, reasons: [] });
  });

  it("rejects a report that fails moving-root locomotion gates", () => {
    expect(
      evaluateCharacterAnimationCapture({
        browserErrors: [],
        report: {
          evaluation: {
            locomotionHardGateFailures: ["stance-contact-drift"],
            locomotionHardGatePassed: false,
          },
          frames: [{ frameIndex: 2, imageNonBlank: true, issues: [], views: [] }],
        },
      }),
    ).toEqual({ ok: false, reasons: ["locomotion hard gate: stance-contact-drift"] });
  });
});
