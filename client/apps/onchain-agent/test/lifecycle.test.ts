import { describe, it, expect } from "vitest";

describe("ShutdownGate", () => {
  it("gate promise does not resolve until shutdown is called", async () => {
    const { createShutdownGate } = await import("../src/shutdown-gate");
    
    const gate = createShutdownGate();
    
    let resolved = false;
    gate.promise.then(() => { resolved = true; });
    
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(false);
    
    gate.shutdown();
    await new Promise(r => setTimeout(r, 50));
    expect(resolved).toBe(true);
  });
  
  it("shutdown is idempotent — resolves only once", async () => {
    const { createShutdownGate } = await import("../src/shutdown-gate");
    
    const gate = createShutdownGate();
    let resolveCount = 0;
    gate.promise.then(() => { resolveCount++; });
    
    gate.shutdown();
    gate.shutdown();
    gate.shutdown();
    
    await new Promise(r => setTimeout(r, 50));
    expect(resolveCount).toBe(1);
  });
});
