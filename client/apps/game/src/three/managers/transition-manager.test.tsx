// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const setIsLoadingScreenEnabled = vi.fn();
const setTooltip = vi.fn();

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: {
    getState: () => ({
      setIsLoadingScreenEnabled,
      setTooltip,
    }),
  },
}));

const { TransitionManager } = await import("./transition-manager");

describe("TransitionManager lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  it("cancels a pending fade-out callback during destroy", () => {
    const manager = new TransitionManager();
    const onComplete = vi.fn();

    manager.fadeOut(onComplete);
    manager.destroy();
    vi.runAllTimers();

    expect(onComplete).not.toHaveBeenCalled();
    expect(setIsLoadingScreenEnabled).toHaveBeenCalledWith(true);
  });
});
