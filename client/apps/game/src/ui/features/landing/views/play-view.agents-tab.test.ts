// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView agents tab integration", () => {
  it("supports agents as a valid home tab and renders an AgentsDashboard entry point", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain('type PlayTab = "play" | "learn" | "news" | "factory" | "agents"');
    expect(source).toContain('case "agents":');
    expect(source).toContain("<AgentsDashboard");
  });
});
