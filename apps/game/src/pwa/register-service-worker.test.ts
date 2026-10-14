import { afterEach, describe, expect, it, vi } from "vitest";
import { registerGameServiceWorker } from "./register-service-worker";

const RUNNING = "release-a";

class Worker extends EventTarget {
  state: ServiceWorkerState = "installed";
  constructor(readonly release: string | null) {
    super();
  }
  postMessage = vi.fn((message: { type: string }, ports?: MessagePort[]) => {
    if (message.type === "RELEASE") ports![0].postMessage(this.release);
  });
  transition(state: ServiceWorkerState) {
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

function registrationFixture(release: string | null = "release-b") {
  const worker = new Worker(release);
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
  vi.restoreAllMocks();
});

describe("service worker registration", () => {
  it("offers an existing update and activates only after explicit acceptance", async () => {
    const { worker, register } = registrationFixture();
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(RUNNING, ready);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" });
    expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "SKIP_WAITING" });
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
    const focus = vi.spyOn(window, "addEventListener");
    const cleanup = registerGameServiceWorker(RUNNING, ready);
    await vi.waitFor(() => expect(focus).toHaveBeenCalledWith("focus", expect.any(Function), undefined));
    expect(ready).not.toHaveBeenCalled();
    registration.active = {};
    window.dispatchEvent(new Event("focus"));
    await vi.waitFor(() => expect(registration.update).toHaveBeenCalledOnce());
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    registration.waiting = worker;
    worker.transition("installed");
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    cleanup();
    worker.transition("activated");
    window.dispatchEvent(new Event("focus"));
    expect(ready).toHaveBeenCalledOnce();
    expect(registration.update).toHaveBeenCalledOnce();
  });

  it("rejects failed activation and permits a later attempt", async () => {
    registrationFixture();
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(RUNNING, ready);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    vi.useFakeTimers();
    const activation = ready.mock.calls[0][0]();
    const rejected = expect(activation).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    cleanup();
  });

  it("does not publish an update after the owner unmounts", async () => {
    registrationFixture();
    const ready = vi.fn();
    registerGameServiceWorker(RUNNING, ready)();
    await Promise.resolve();
    expect(ready).not.toHaveBeenCalled();
  });

  it("never offers a waiting worker that serves the running release", async () => {
    const { worker } = registrationFixture(RUNNING);
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(RUNNING, ready);
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "RELEASE" }, expect.any(Array)));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ready).not.toHaveBeenCalled();
    cleanup();
  });

  it("offers a new release once, however often the worker is seen again", async () => {
    const { registration, worker } = registrationFixture();
    const ready = vi.fn();
    const cleanup = registerGameServiceWorker(RUNNING, ready);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    registration.installing = worker;
    registration.dispatchEvent(new Event("updatefound"));
    worker.transition("installed");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ready).toHaveBeenCalledOnce();
    cleanup();
  });
});

it("offers a legacy null release but does not confuse malformed replies with legacy", async () => {
  registrationFixture(null);
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  cleanup();
});

it("retries a failed release query on focus without offering a timeout as an update", async () => {
  vi.useFakeTimers();
  const { worker } = registrationFixture();
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  worker.postMessage.mockImplementation(() => {});
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(3000);
  expect(ready).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith("pwa_registration_failed", expect.objectContaining({ reason: "timeout" }));
  worker.postMessage.mockImplementation((message, ports) => {
    if (message.type === "RELEASE") ports![0].postMessage("release-b");
  });
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  cleanup();
});

it("keeps activation bound to the offered worker and removes the listener on success", async () => {
  const { worker, registration } = registrationFixture();
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  const replacement = new Worker("release-c");
  registration.waiting = replacement;
  const remove = vi.spyOn(worker, "removeEventListener");
  const activation = ready.mock.calls[0][0]();
  worker.transition("activated");
  await activation;
  expect(replacement.postMessage).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function));
  cleanup();
});

it("cleans activation listeners after send failure, timeout and cancellation", async () => {
  const { worker } = registrationFixture();
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  const remove = vi.spyOn(worker, "removeEventListener");
  worker.postMessage.mockImplementation(() => {
    throw new Error("send failed");
  });
  await expect(ready.mock.calls[0][0]()).rejects.toThrow("Could not activate update");
  expect(remove).toHaveBeenCalledTimes(1);
  worker.postMessage.mockImplementation(() => {});
  vi.useFakeTimers();
  const timed = expect(ready.mock.calls[0][0]()).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(10000);
  await timed;
  expect(remove).toHaveBeenCalledTimes(2);
  const cancelled = expect(ready.mock.calls[0][0]()).rejects.toThrow();
  cleanup();
  await cancelled;
  expect(remove).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not offer a release reply that arrives after unmount", async () => {
  const { worker } = registrationFixture();
  let reply!: MessagePort;
  worker.postMessage.mockImplementation((_message, ports) => {
    reply = ports![0];
  });
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(reply).toBeDefined());
  cleanup();
  reply.postMessage("release-b");
  await new Promise((resolve) => setTimeout(resolve, 10));
  expect(ready).not.toHaveBeenCalled();
});

it("rejects an offered worker superseded before acceptance", async () => {
  const { worker } = registrationFixture();
  const ready = vi.fn();
  const cleanup = registerGameServiceWorker(RUNNING, ready);
  await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
  worker.transition("redundant");
  const remove = vi.spyOn(worker, "removeEventListener");
  await expect(ready.mock.calls[0][0]()).rejects.toThrow("Update was superseded");
  expect(worker.postMessage).not.toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  expect(remove).toHaveBeenCalledWith("statechange", expect.any(Function));
  cleanup();
});
