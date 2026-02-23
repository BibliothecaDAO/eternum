import { describe, expect, it, beforeEach } from "vitest";
import { JsonEmitter } from "../../src/output/json-emitter";

describe("JsonEmitter", () => {
  let writtenLines: string[];
  let emitter: JsonEmitter;

  beforeEach(() => {
    writtenLines = [];
    emitter = new JsonEmitter({
      verbosity: "all",
      write: (line) => writtenLines.push(line),
    });
  });

  it("emits startup event as NDJSON", () => {
    emitter.emit({ type: "startup", world: "test-world", chain: "slot", address: "0x1" });
    expect(writtenLines).toHaveLength(1);
    const parsed = JSON.parse(writtenLines[0]);
    expect(parsed.type).toBe("startup");
    expect(parsed.world).toBe("test-world");
    expect(parsed.ts).toBeDefined();
  });

  it("filters tick events at actions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "actions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "tick", id: 1, state: {} });
    expect(writtenLines).toHaveLength(0);
  });

  it("passes action events at actions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "actions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "action", tick: 1, action: "guard_add", params: {}, status: "ok", txHash: "0x1" });
    expect(writtenLines).toHaveLength(1);
  });

  it("passes error events at quiet verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "error", message: "something broke" });
    expect(writtenLines).toHaveLength(1);
  });

  it("filters decision events at quiet verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "decision", tick: 1, reasoning: "thinking", actions: [] });
    expect(writtenLines).toHaveLength(0);
  });

  it("filters action events at quiet verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "action", tick: 1, action: "test", params: {}, status: "ok" });
    expect(writtenLines).toHaveLength(0);
  });

  it("passes decision events at decisions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "decisions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "decision", tick: 1, reasoning: "thinking", actions: [] });
    expect(writtenLines).toHaveLength(1);
  });

  it("passes heartbeat events at decisions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "decisions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "heartbeat", job: "resource-check", mode: "observe" });
    expect(writtenLines).toHaveLength(1);
  });

  it("filters tick events at decisions verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "decisions", write: (line) => writtenLines.push(line) });
    emitter.emit({ type: "tick", id: 1, state: {} });
    expect(writtenLines).toHaveLength(0);
  });

  it("allows subscribing to events", () => {
    const received: any[] = [];
    emitter.subscribe((event) => received.push(event));
    emitter.emit({ type: "startup", world: "w", chain: "slot", address: "0x1" });
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("startup");
  });

  it("subscribers receive all events regardless of verbosity", () => {
    emitter = new JsonEmitter({ verbosity: "quiet", write: (line) => writtenLines.push(line) });
    const received: any[] = [];
    emitter.subscribe((event) => received.push(event));
    emitter.emit({ type: "tick", id: 1, state: {} });
    // Not written to stdout (quiet filters tick)
    expect(writtenLines).toHaveLength(0);
    // But subscriber still gets it
    expect(received).toHaveLength(1);
  });

  it("unsubscribe stops delivery", () => {
    const received: any[] = [];
    const unsub = emitter.subscribe((event) => received.push(event));
    emitter.emit({ type: "startup", world: "w", chain: "slot", address: "0x1" });
    unsub();
    emitter.emit({ type: "shutdown", reason: "test" });
    expect(received).toHaveLength(1);
  });
});
