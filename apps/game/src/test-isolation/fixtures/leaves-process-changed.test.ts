import { describe, it } from "vitest";

// A file that leaves the worker's process changed. Run only by file-boundary.test.ts, which expects it to fail.
describe.runIf(process.env.ETERNUM_FILE_BOUNDARY === "1")("a file that cleans up nothing", () => {
  it("sets an environment variable and adds a process listener", () => {
    process.env.FILE_BOUNDARY_LEFT = "1";
    process.on("file-boundary-left", () => {});
  });
});
