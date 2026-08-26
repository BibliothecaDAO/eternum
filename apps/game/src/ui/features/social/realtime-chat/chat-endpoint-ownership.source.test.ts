// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("realtime chat endpoint ownership", () => {
  it("uses the dedicated chat endpoint and leaves it unset in the Madara lab", () => {
    const sidebarSource = readFileSync(
      resolve(process.cwd(), "src/ui/features/world/containers/left-command-sidebar.tsx"),
      "utf8",
    );
    const madaraEnvSample = readFileSync(resolve(process.cwd(), ".env.madara.blitz.sample"), "utf8");

    expect(sidebarSource).toContain("env.VITE_PUBLIC_CHAT_URL");
    expect(sidebarSource).not.toContain("VITE_PUBLIC_REALTIME_URL");
    expect(madaraEnvSample).toMatch(/^VITE_PUBLIC_CHAT_URL=$/m);
  });
});
