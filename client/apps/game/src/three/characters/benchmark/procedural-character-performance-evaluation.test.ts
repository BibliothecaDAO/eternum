import { describe, expect, it } from "vitest";

import { ProceduralCharacterPerformanceEvaluator } from "./procedural-character-performance-evaluation";

const SAMPLE_60_FPS = { animationCpuMs: 4, frameMs: 16.5, renderCpuMs: 2, totalCpuMs: 7 };

describe("ProceduralCharacterPerformanceEvaluator", () => {
  it("warms up, captures a fixed sample, and passes a 60 FPS workload", () => {
    const evaluator = new ProceduralCharacterPerformanceEvaluator(2, 4);
    evaluator.setDisplayRefreshFps(60);
    evaluator.setGpuTimerSupported(true);
    for (let index = 0; index < 6; index += 1) {
      evaluator.recordFrame(SAMPLE_60_FPS);
      if (index >= 2) evaluator.recordGpuFrame(5);
    }

    expect(evaluator.getSnapshot()).toMatchObject({
      headroomPass: true,
      observedFps: 60.61,
      onScreenPass: true,
      sampleCount: 4,
      state: "complete",
      status: "pass",
    });
  });

  it("distinguishes a display refresh ceiling from workload headroom", () => {
    const evaluator = new ProceduralCharacterPerformanceEvaluator(0, 4);
    evaluator.setDisplayRefreshFps(50);
    for (let index = 0; index < 4; index += 1) {
      evaluator.recordFrame({ ...SAMPLE_60_FPS, frameMs: 20 });
    }

    expect(evaluator.getSnapshot()).toMatchObject({
      headroomPass: true,
      observedFps: 50,
      onScreenPass: false,
      status: "display-limited",
    });
  });

  it("fails when CPU work exceeds the frame budget", () => {
    const evaluator = new ProceduralCharacterPerformanceEvaluator(0, 4);
    evaluator.setDisplayRefreshFps(60);
    for (let index = 0; index < 4; index += 1) {
      evaluator.recordFrame({ animationCpuMs: 18, frameMs: 25, renderCpuMs: 3, totalCpuMs: 22 });
    }

    const result = evaluator.getSnapshot();
    expect(result.status).toBe("fail");
    expect(result.reasons).toContain("CPU p95 is 22ms; budget is 16.67ms");
  });

  it("rejects a high average FPS when presentation p95 still stutters", () => {
    const evaluator = new ProceduralCharacterPerformanceEvaluator(0, 20);
    evaluator.setDisplayRefreshFps(60);
    for (let index = 0; index < 19; index += 1) evaluator.recordFrame({ ...SAMPLE_60_FPS, frameMs: 10 });
    evaluator.recordFrame({ ...SAMPLE_60_FPS, frameMs: 24 });

    const result = evaluator.getSnapshot();
    expect(result.observedFps).toBeGreaterThan(60);
    expect(result.onScreenPass).toBe(false);
    expect(result.status).toBe("fail");
  });

  it("resets samples without discarding display calibration", () => {
    const evaluator = new ProceduralCharacterPerformanceEvaluator(0, 1);
    evaluator.setDisplayRefreshFps(50);
    evaluator.recordFrame(SAMPLE_60_FPS);
    evaluator.reset();

    expect(evaluator.getSnapshot()).toMatchObject({ displayRefreshFps: 50, sampleCount: 0, state: "sampling" });
  });
});
