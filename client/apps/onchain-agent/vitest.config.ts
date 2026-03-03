import { defineConfig } from "vitest/config";
import path from "node:path";
import { readFileSync, readdirSync } from "node:fs";

// Build embedded-data stub from actual files so tests use real content.
// This replaces the Bun-specific `with { type: "text" }` imports that Vite can't parse.
function buildEmbeddedDataStub(): string {
  const dataDir = path.resolve(__dirname, "data");
  const taskFiles = readdirSync(path.join(dataDir, "tasks")).filter((f) => f.endsWith(".md"));

  const entries: Record<string, string> = {
    "soul.md": readFileSync(path.join(dataDir, "soul.md"), "utf8"),
    "HEARTBEAT.md": readFileSync(path.join(dataDir, "HEARTBEAT.md"), "utf8"),
  };
  for (const f of taskFiles) {
    entries[`tasks/${f}`] = readFileSync(path.join(dataDir, "tasks", f), "utf8");
  }

  const envExample = readFileSync(path.resolve(__dirname, ".env.example"), "utf8");

  return [
    `export const embeddedData = ${JSON.stringify(entries)};`,
    `export const embeddedEnvExample = ${JSON.stringify(envExample)};`,
  ].join("\n");
}

const embeddedDataPath = path.resolve(__dirname, "src/embedded-data.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@bibliothecadao/game-agent": path.resolve(__dirname, "../../../packages/game-agent/src/index.ts"),
    },
  },
  plugins: [
    {
      name: "embedded-data-stub",
      load(id) {
        if (id === embeddedDataPath) {
          return buildEmbeddedDataStub();
        }
      },
    },
  ],
  define: {
    BUILD_VERSION: JSON.stringify(
      JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf8")).version,
    ),
  },
  test: {
    globals: true,
    environment: "node",
  },
});
