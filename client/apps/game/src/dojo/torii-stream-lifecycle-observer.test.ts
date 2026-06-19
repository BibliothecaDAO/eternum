import { describe, expect, it, vi } from "vitest";
import { observeToriiStreamLifecycle } from "./torii-stream-lifecycle-observer";

describe("observeToriiStreamLifecycle", () => {
  it("is a no-op for a cancel-only subscription (current torii-wasm shape)", () => {
    const onClose = vi.fn();
    const detach = observeToriiStreamLifecycle({ cancel: () => {} }, onClose);
    detach();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is a no-op for non-object subscriptions", () => {
    const onClose = vi.fn();
    expect(() => observeToriiStreamLifecycle(null, onClose)()).not.toThrow();
    expect(() => observeToriiStreamLifecycle(undefined, onClose)()).not.toThrow();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("wires Node-style emitter error/close events when present", () => {
    const handlers: Record<string, (arg?: unknown) => void> = {};
    const sub = {
      cancel: () => {},
      on: (event: string, cb: (arg?: unknown) => void) => {
        handlers[event] = cb;
      },
      off: vi.fn(),
    };
    const onClose = vi.fn();

    observeToriiStreamLifecycle(sub, onClose);
    handlers.error?.(new Error("boom"));
    expect(onClose).toHaveBeenCalledWith({ reason: "boom" });

    handlers.close?.();
    expect(onClose).toHaveBeenCalledWith({ reason: "close" });
  });

  it("detaches emitter listeners via off", () => {
    const off = vi.fn();
    const sub = { cancel: () => {}, on: () => {}, off };
    const detach = observeToriiStreamLifecycle(sub, vi.fn());
    detach();
    expect(off).toHaveBeenCalledWith("error", expect.any(Function));
    expect(off).toHaveBeenCalledWith("close", expect.any(Function));
  });

  it("wires assignable onerror/onclose handler slots when present", () => {
    const sub: { cancel: () => void; onerror: ((e: unknown) => void) | null; onclose: (() => void) | null } = {
      cancel: () => {},
      onerror: null,
      onclose: null,
    };
    const onClose = vi.fn();

    const detach = observeToriiStreamLifecycle(sub, onClose);
    sub.onerror?.(new Error("kaboom"));
    expect(onClose).toHaveBeenCalledWith({ reason: "kaboom" });

    detach();
    expect(sub.onerror).toBeNull();
    expect(sub.onclose).toBeNull();
  });
});
