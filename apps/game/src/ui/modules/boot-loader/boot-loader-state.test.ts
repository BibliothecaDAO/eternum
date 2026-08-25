import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setBootDocumentState } from "./boot-loader-state";

describe("boot-loader-state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.dataset.bootState = "booting";

    const bootShell = document.createElement("div");
    bootShell.id = "boot-shell";
    document.body.appendChild(bootShell);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-boot-state");
    document.getElementById("boot-shell")?.remove();
  });

  it("updates the document boot state immediately", () => {
    setBootDocumentState("react-mounted");
    expect(document.documentElement.dataset.bootState).toBe("react-mounted");
    expect(document.getElementById("boot-shell")).not.toBeNull();
  });

  it("removes the html boot shell after app loading handoff", () => {
    setBootDocumentState("app-loading");

    expect(document.documentElement.dataset.bootState).toBe("app-loading");
    expect(document.getElementById("boot-shell")).not.toBeNull();

    vi.advanceTimersByTime(420);

    expect(document.getElementById("boot-shell")).toBeNull();
  });
});
