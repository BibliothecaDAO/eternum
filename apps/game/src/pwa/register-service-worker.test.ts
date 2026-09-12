import { afterEach, describe, expect, it, vi } from "vitest";
import { registerGameServiceWorker } from "./register-service-worker";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installed";
  postMessage = vi.fn();
  transition(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

function registrationFixture() {
  const worker = new Worker();
  const registration = Object.assign(new EventTarget(), {
    active: {} as object | null,
    waiting: worker as Worker | null,
    installing: null as Worker | null,
    update: vi.fn().mockResolvedValue(undefined),
  });
  const register = vi.fn().mockResolvedValue(registration);
  vi.stubGlobal("navigator", { onLine: true, serviceWorker: { register } });
  return { registration, worker, register };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("service worker registration", () => {
  it("offers an existing update and activates only after explicit acceptance", async () => {
    const { worker, register } = registrationFixture();
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(ready);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
    expect(worker.postMessage).not.toHaveBeenCalled();
    const activation = ready.mock.calls[0][0]();
    expect(worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    worker.transition("activated");
    await activation;
    cleanup();
  });

  it("ignores first installation and observes later updates, including focus checks", async () => {
    const { registration, worker } = registrationFixture();
    registration.active = null;
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(ready);
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
    registration.active = {};
    window.dispatchEvent(new Event("focus"));
    expect(registration.update).toHaveBeenCalledOnce();
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    registration.waiting = worker;
    worker.transition("installed");
    expect(ready).toHaveBeenCalledOnce();
    cleanup();
    worker.transition("activated");
    window.dispatchEvent(new Event("focus"));
    expect(ready).toHaveBeenCalledOnce();
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("rejects failed activation and permits a later attempt", async () => {
    vi.useFakeTimers();
    registrationFixture();
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(ready);
    await Promise.resolve();
    const activation = ready.mock.calls[0][0]();
    const rejected = expect(activation).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    cleanup();
  });

  it("does not publish an update after the owner unmounts", async () => {
    registrationFixture();
    const ready = vi.fn();
    registerGameServiceWorker(ready)();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
  });
});
