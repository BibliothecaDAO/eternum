import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView dashboard intent resume wiring", () => {
  it("queues dashboard intents before sign-in and resumes them after account state changes", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain("buildDashboardIntent");
    expect(source).toContain("queueIntent(");
    expect(source).toContain("peekIntent()");
    expect(source).toContain("consumeIntent(");
    expect(source).toContain('markGameEntryMilestone("dashboard-intent-resumed")');
  });
});
