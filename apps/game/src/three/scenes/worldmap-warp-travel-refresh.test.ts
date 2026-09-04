import { describe, expect, it, vi } from "vitest";

import { completeWorldmapInteractiveRefresh } from "./worldmap-warp-travel-refresh";

describe("completeWorldmapInteractiveRefresh", () => {
  it("retries a dropped resume transition and completes after the retry commits", async () => {
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(
      completeWorldmapInteractiveRefresh({
        phase: "resume",
        refresh,
      }),
    ).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("retries a dropped initial transition and completes after the retry commits", async () => {
    const refresh = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(
      completeWorldmapInteractiveRefresh({
        phase: "initial",
        refresh,
      }),
    ).resolves.toBeUndefined();

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("keeps initial entry fail-closed after both attempts are dropped", async () => {
    const refresh = vi.fn().mockResolvedValue(false);

    await expect(
      completeWorldmapInteractiveRefresh({
        phase: "initial",
        refresh,
      }),
    ).rejects.toThrow("World map did not finish its initial interactive refresh.");

    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("reports a resume-specific failure after both attempts are dropped", async () => {
    const refresh = vi.fn().mockResolvedValue(false);

    await expect(
      completeWorldmapInteractiveRefresh({
        phase: "resume",
        refresh,
      }),
    ).rejects.toThrow("World map did not finish its resume interactive refresh.");

    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
