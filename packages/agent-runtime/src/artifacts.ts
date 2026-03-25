import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { AgentArtifactStore, AgentArtifacts, LoadAgentArtifactsInput, SaveAgentArtifactsInput } from "./types";

const DEFAULT_ARTIFACT_FILES = [
  "soul.md",
  "memory.md",
  "tasks/priorities.md",
  "tasks/combat.md",
  "tasks/economy.md",
  "tasks/exploration.md",
  "tasks/reflection.md",
  "automation-status.txt",
];

export class FileSystemAgentArtifactStore implements AgentArtifactStore {
  constructor(private readonly baseDir: string) {}

  async load(input: LoadAgentArtifactsInput): Promise<AgentArtifacts> {
    const files = input.files ?? DEFAULT_ARTIFACT_FILES;
    const loadedFiles = await Promise.all(
      files.map(async (relativePath) => {
        const fullPath = join(this.baseDir, input.agentId, relativePath);
        try {
          return [relativePath, await readFile(fullPath, "utf8")] as const;
        } catch {
          return [relativePath, ""] as const;
        }
      }),
    );

    return {
      agentId: input.agentId,
      files: Object.fromEntries(loadedFiles),
    };
  }

  async save(input: SaveAgentArtifactsInput): Promise<void> {
    await Promise.all(
      Object.entries(input.files).map(async ([relativePath, content]) => {
        const fullPath = join(this.baseDir, input.agentId, relativePath);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, "utf8");
      }),
    );
  }
}

export async function loadAgentArtifacts(
  input: LoadAgentArtifactsInput & {
    store: AgentArtifactStore;
  },
): Promise<AgentArtifacts> {
  return input.store.load(input);
}

export async function saveAgentArtifacts(
  input: SaveAgentArtifactsInput & {
    store: AgentArtifactStore;
  },
): Promise<void> {
  await input.store.save(input);
}

export async function materializeAgentArtifacts(input: { dataDir: string; artifacts: AgentArtifacts }): Promise<void> {
  await Promise.all(
    Object.entries(input.artifacts.files).map(async ([relativePath, content]) => {
      const filePath = join(input.dataDir, relativePath);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf8");
    }),
  );
}
