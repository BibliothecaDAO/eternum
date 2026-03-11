import { createInterface, type Interface } from "node:readline";
import type { Readable } from "node:stream";

interface StdinDeps {
  enqueuePrompt: (content: string) => Promise<void>;
  applyConfig: (changes: Array<{ path: string; value: unknown }>) => Promise<unknown>;
  shutdown: () => Promise<void>;
}

export function startStdinReader(deps: StdinDeps, input: Readable = process.stdin): () => void {
  const rl: Interface = createInterface({ input });

  rl.on("line", async (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const cmd = JSON.parse(trimmed);
      switch (cmd.type) {
        case "prompt":
          if (typeof cmd.content === "string" && cmd.content.trim()) {
            await deps.enqueuePrompt(cmd.content);
          }
          break;
        case "config":
          if (Array.isArray(cmd.changes)) {
            await deps.applyConfig(cmd.changes);
          }
          break;
        case "shutdown":
          await deps.shutdown();
          break;
      }
    } catch {
      // Ignore malformed JSON lines
    }
  });

  return () => rl.close();
}
