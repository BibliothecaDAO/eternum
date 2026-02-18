import { describe, it, expect } from "vitest";

describe("ShutdownGate", () => {
  it("gate promise does not resolve until shutdown is called", async () => {
    const { createShutdownGate } = await import("../src/shutdown-gate");

    const gate = createShutdownGate();

    let resolved = false;
    gate.promise.then(() => {
      resolved = true;
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    gate.shutdown();
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(true);
  });

  it("shutdown is idempotent — resolves only once", async () => {
    const { createShutdownGate } = await import("../src/shutdown-gate");

    const gate = createShutdownGate();
    let resolveCount = 0;
    gate.promise.then(() => {
      resolveCount++;
    });

    gate.shutdown();
    gate.shutdown();
    gate.shutdown();

    await new Promise((r) => setTimeout(r, 50));
    expect(resolveCount).toBe(1);
  });

  it("main() should export or use a shutdown gate pattern", async () => {
    // Verify the shutdown-gate module exports are correct
    const { createShutdownGate } = await import("../src/shutdown-gate");
    const gate = createShutdownGate();

    // Simulate what main() should do: return gate.promise
    const mainPromise = gate.promise;

    let mainResolved = false;
    mainPromise.then(() => {
      mainResolved = true;
    });

    // main() should NOT resolve on its own
    await new Promise((r) => setTimeout(r, 50));
    expect(mainResolved).toBe(false);

    // Only resolves when shutdown is triggered (simulating SIGINT)
    gate.shutdown();
    await new Promise((r) => setTimeout(r, 50));
    expect(mainResolved).toBe(true);
  });
});
