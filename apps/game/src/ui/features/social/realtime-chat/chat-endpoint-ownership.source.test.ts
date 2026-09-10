// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("realtime chat endpoint ownership", () => {
  it("uses the dedicated chat endpoint that the default local env points at the lab", () => {
    const sidebarSource = readFileSync(
      resolve(process.cwd(), "src/ui/features/world/containers/left-command-sidebar.tsx"),
      "utf8",
    );
    const localEnv = readFileSync(resolve(process.cwd(), ".env"), "utf8");

    expect(sidebarSource).toContain("env.VITE_PUBLIC_CHAT_URL");
    expect(sidebarSource).toContain("`game:${gameId}`");
    expect(sidebarSource).not.toContain('"global"');
    expect(sidebarSource).not.toContain("queryParams");
    expect(sidebarSource).not.toContain("demo-player");
    expect(sidebarSource).not.toContain("VITE_PUBLIC_REALTIME_URL");
    expect(localEnv).toMatch(/^VITE_PUBLIC_CHAT_URL=https:\/\/.+$/m);
  });
});
