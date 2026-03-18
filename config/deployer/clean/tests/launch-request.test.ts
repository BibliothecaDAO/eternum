import { describe, expect, test } from "bun:test";
import { buildLaunchGameRequest, resolveLaunchGameStepId } from "../cli/launch-request";

describe("launch request helpers", () => {
  test("builds a launch request from shared CLI args", () => {
    expect(
      buildLaunchGameRequest({
        environment: "slot.blitz",
        game: "bltz-test-1",
        "start-time": "2026-03-18T10:00:00Z",
        "two-player-mode": "true",
        "duration-seconds": "3600",
      }),
    ).toMatchObject({
      environmentId: "slot.blitz",
      gameName: "bltz-test-1",
      startTime: "2026-03-18T10:00:00Z",
      twoPlayerMode: true,
      durationSeconds: 3600,
    });
  });

  test("resolves supported launch step ids", () => {
    expect(resolveLaunchGameStepId("create-world")).toBe("create-world");
    expect(resolveLaunchGameStepId("configure-world")).toBe("configure-world");
    expect(resolveLaunchGameStepId("create-indexer")).toBe("create-indexer");
  });

  test("rejects unsupported launch step ids", () => {
    expect(() => resolveLaunchGameStepId("full")).toThrow('Unsupported launch step "full"');
  });
});
