import { describe, expect, it } from "vitest";

/**
 * One file's use of the performance timeline: it must find no mark or measure another file left, then leaves its own.
 * Run only by file-boundary.test.ts, which puts every fixture on one worker.
 */
export const describeTimelineFile = () =>
  describe.runIf(process.env.ETERNUM_FILE_BOUNDARY === "1")("a file on a reused worker", () => {
    it("starts on an empty timeline and leaves marks and measures behind", () => {
      expect(performance.getEntriesByName("file-boundary")).toEqual([]);
      performance.mark("file-boundary");
      performance.measure("file-boundary", "file-boundary");
      expect(performance.getEntriesByName("file-boundary").map((entry) => entry.entryType)).toEqual([
        "mark",
        "measure",
      ]);
    });
  });
