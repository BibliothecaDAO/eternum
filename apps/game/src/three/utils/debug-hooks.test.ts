import { describe, expect, it } from "vitest";

import { getRegisteredDebugHooks, registerDebugHook, unregisterDebugHook } from "./debug-hooks";

describe("debug-hooks registry", () => {
  it("registers hooks in DEV mode and records them in the registry", () => {
    const target: Record<string, unknown> = {};
    const hook = () => "ok";

    const installed = registerDebugHook("testHook", hook, { target, isDev: true });

    expect(installed).toBe(true);
    expect(target.testHook).toBe(hook);
    expect(getRegisteredDebugHooks({ target })).toEqual(["testHook"]);
  });

  it("does not register hooks outside DEV mode", () => {
    const target: Record<string, unknown> = {};
    const hook = () => "ok";

    const installed = registerDebugHook("testHook", hook, { target, isDev: false });

    expect(installed).toBe(false);
    expect(target.testHook).toBeUndefined();
    expect(getRegisteredDebugHooks({ target })).toEqual([]);
  });

  it("unregisters previously-installed hooks", () => {
    const target: Record<string, unknown> = {};
    const hook = () => "ok";

    registerDebugHook("testHook", hook, { target, isDev: true });
    unregisterDebugHook("testHook", { target });

    expect(target.testHook).toBeUndefined();
    expect(getRegisteredDebugHooks({ target })).toEqual([]);
  });
});
