import { afterEach, describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/react", () => ({ captureException }));

import { isPresentableStory } from "./use-story-events-store";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  captureException.mockClear();
});

describe("a story row the log cannot present", () => {
  it("is shown when its story has a line", () => {
    expect(isPresentableStory({ story: "SitePayout" })).toBe(true);
  });

  it("is an error outside production", () => {
    expect(() => isPresentableStory({ story: "RetiredStory" })).toThrow("No presentation for story RetiredStory");
  });

  it("is dropped and reported in production, never rendered raw and never taking the log down", () => {
    vi.stubEnv("PROD", true);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(isPresentableStory({ story: "RetiredStory" })).toBe(false);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining("RetiredStory"));
    expect(captureException).toHaveBeenCalledWith(expect.any(Error), { tags: { story: "RetiredStory" } });
  });
});
