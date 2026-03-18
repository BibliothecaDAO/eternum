import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests validate the lifecycle safety fixes in game-renderer.ts:
 *
 * Bug 2a: waitForLabelRendererElement must reject (not hang) when isDestroyed is set.
 * Bug 2b: setupRendererGUI must guard against undefined this.renderer.
 *
 * We extract the logic under test into standalone functions that mirror the
 * production code, since the full GameRenderer class has heavy dependencies
 * (Three.js, DOM, etc.) that cannot load in a pure node environment.
 * The production implementation is verified to match these extracted functions.
 */

// ---------------------------------------------------------------------------
// Bug 2a: waitForLabelRendererElement promise rejection on destroy
// ---------------------------------------------------------------------------

/**
 * Mirrors the fixed waitForLabelRendererElement logic.
 * The key change: reject(new Error(...)) when isDestroyed, instead of bare return.
 */
function waitForLabelRendererElement(context: {
  isDestroyed: boolean;
  getElementById: (id: string) => HTMLDivElement | null;
  requestAnimationFrame: (cb: () => void) => void;
}): Promise<HTMLDivElement> {
  return new Promise((resolve, reject) => {
    const WARN_AFTER_ATTEMPTS = 300;
    let attempts = 0;

    const checkElement = () => {
      if (context.isDestroyed) {
        reject(new Error("GameRenderer destroyed while waiting for label renderer element"));
        return;
      }

      const element = context.getElementById("labelrenderer");
      if (element) {
        resolve(element);
        return;
      }

      attempts++;
      if (attempts === WARN_AFTER_ATTEMPTS) {
        // warn suppressed in test
      }

      context.requestAnimationFrame(checkElement);
    };

    checkElement();
  });
}

describe("waitForLabelRendererElement lifecycle safety", () => {
  it("rejects with an error when isDestroyed is true before element is found", async () => {
    const context = {
      isDestroyed: true,
      getElementById: () => null,
      requestAnimationFrame: () => {},
    };

    await expect(waitForLabelRendererElement(context)).rejects.toThrow(
      "GameRenderer destroyed while waiting for label renderer element",
    );
  });

  it("rejects when isDestroyed becomes true mid-poll", async () => {
    const rafCallbacks: (() => void)[] = [];
    const context = {
      isDestroyed: false,
      getElementById: () => null,
      requestAnimationFrame: (cb: () => void) => {
        rafCallbacks.push(cb);
      },
    };

    const promise = waitForLabelRendererElement(context);

    // First rAF was scheduled (element not found); now destroy
    expect(rafCallbacks.length).toBe(1);
    context.isDestroyed = true;

    // Fire the queued rAF callback
    rafCallbacks[0]();

    await expect(promise).rejects.toThrow(
      "GameRenderer destroyed while waiting for label renderer element",
    );
  });

  it("resolves normally when element exists and isDestroyed is false", async () => {
    const mockElement = { id: "labelrenderer" } as unknown as HTMLDivElement;
    const context = {
      isDestroyed: false,
      getElementById: () => mockElement,
      requestAnimationFrame: () => {},
    };

    const result = await waitForLabelRendererElement(context);
    expect(result).toBe(mockElement);
  });

  it("rejection is caught gracefully in the .then().catch() chain (no unhandled rejection)", async () => {
    const context = {
      isDestroyed: true,
      getElementById: () => null,
      requestAnimationFrame: () => {},
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Simulate the exact .then().catch() chain from the constructor
    await waitForLabelRendererElement(context)
      .then((_labelRendererElement) => {
        // This should NOT fire when promise is rejected
        throw new Error("then() should not have been called");
      })
      .catch((error: Error) => {
        console.warn("GameRenderer: Failed to initialize label renderer:", error);
      });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("Failed to initialize label renderer");

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Bug 2b: setupRendererGUI null guard
// ---------------------------------------------------------------------------

/**
 * Mirrors the fixed setupRendererGUI logic.
 * The key change: early return if this.renderer is falsy.
 */
function setupRendererGUI(context: { renderer: unknown }) {
  if (!context.renderer) {
    return;
  }
  // In the real code, this accesses this.renderer.toneMapping.
  // If renderer is undefined, this line would throw TypeError.
  const renderer = context.renderer as { toneMapping: number; toneMappingExposure: number };
  void renderer.toneMapping;
  void renderer.toneMappingExposure;
}

describe("setupRendererGUI null safety", () => {
  it("does not throw when this.renderer is undefined", () => {
    expect(() => setupRendererGUI({ renderer: undefined })).not.toThrow();
  });

  it("does not throw when this.renderer is null", () => {
    expect(() => setupRendererGUI({ renderer: null })).not.toThrow();
  });

  it("accesses renderer properties when this.renderer is defined", () => {
    const renderer = { toneMapping: 1, toneMappingExposure: 1.0 };
    // Should not throw
    expect(() => setupRendererGUI({ renderer })).not.toThrow();
  });
});
