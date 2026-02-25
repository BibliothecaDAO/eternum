import { describe, expect, it, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { startStdinReader } from "../../src/input/stdin-reader";

function createMockStream(lines: string[]): Readable {
  const stream = new Readable({ read() {} });
  // Push lines async to simulate real stdin
  setImmediate(() => {
    for (const line of lines) {
      stream.push(line + "\n");
    }
    stream.push(null);
  });
  return stream;
}

describe("stdin-reader", () => {
  let promptQueue: string[];
  let configChanges: unknown[];
  let shutdownCalled: boolean;
  let deps: Parameters<typeof startStdinReader>[0];

  beforeEach(() => {
    promptQueue = [];
    configChanges = [];
    shutdownCalled = false;
    deps = {
      enqueuePrompt: async (content) => {
        promptQueue.push(content);
      },
      applyConfig: async (changes) => {
        configChanges.push(changes);
        return { ok: true };
      },
      shutdown: async () => {
        shutdownCalled = true;
      },
    };
  });

  it("dispatches prompt commands", async () => {
    const stream = createMockStream(['{"type":"prompt","content":"build farms"}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(promptQueue).toEqual(["build farms"]);
    close();
  });

  it("dispatches config commands", async () => {
    const stream = createMockStream(['{"type":"config","changes":[{"path":"tickIntervalMs","value":30000}]}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(configChanges).toHaveLength(1);
    close();
  });

  it("dispatches shutdown commands", async () => {
    const stream = createMockStream(['{"type":"shutdown"}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(shutdownCalled).toBe(true);
    close();
  });

  it("ignores malformed JSON", async () => {
    const stream = createMockStream(["not json", '{"type":"prompt","content":"valid"}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(promptQueue).toEqual(["valid"]);
    close();
  });

  it("ignores empty lines", async () => {
    const stream = createMockStream(["", "  ", '{"type":"prompt","content":"hello"}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(promptQueue).toEqual(["hello"]);
    close();
  });

  it("ignores prompts with empty content", async () => {
    const stream = createMockStream(['{"type":"prompt","content":""}']);
    const close = startStdinReader(deps, stream);

    await new Promise((r) => setTimeout(r, 50));
    expect(promptQueue).toEqual([]);
    close();
  });
});
