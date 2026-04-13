import { describe, expect, it, vi } from "vitest";

import { handleWorldmapCriticalManagerCatchUpFailures } from "./worldmap-critical-manager-catchup-runtime";

describe("handleWorldmapCriticalManagerCatchUpFailures", () => {
  it("records each critical failure and schedules one recovery refresh", () => {
    const onManagerFailure = vi.fn();
    const scheduleRecovery = vi.fn();

    const failureCount = handleWorldmapCriticalManagerCatchUpFailures({
      chunkKey: "24,24",
      failures: [
        { label: "army", reason: new Error("army failed") },
        { label: "structure", reason: new Error("structure failed") },
      ],
      onManagerFailure,
      scheduleRecovery,
    });

    expect(failureCount).toBe(2);
    expect(onManagerFailure).toHaveBeenCalledTimes(2);
    expect(scheduleRecovery).toHaveBeenCalledTimes(1);
    expect(scheduleRecovery).toHaveBeenCalledWith("24,24", ["army", "structure"]);
  });

  it("does nothing when all critical managers succeed", () => {
    const onManagerFailure = vi.fn();
    const scheduleRecovery = vi.fn();

    const failureCount = handleWorldmapCriticalManagerCatchUpFailures({
      chunkKey: "24,24",
      failures: [],
      onManagerFailure,
      scheduleRecovery,
    });

    expect(failureCount).toBe(0);
    expect(onManagerFailure).not.toHaveBeenCalled();
    expect(scheduleRecovery).not.toHaveBeenCalled();
  });
});
