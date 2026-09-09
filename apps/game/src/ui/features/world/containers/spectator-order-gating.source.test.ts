import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
it("routes HUD order gating through the session-aware gate", () => {
  const files = readdirSync("src/ui/features/world/containers", { recursive: true }).filter(
    (name) => typeof name === "string" && name.endsWith(".tsx") && !name.includes(".test."),
  );
  for (const file of files) {
    const source = readFileSync(join("src/ui/features/world/containers", String(file)), "utf8");
    expect(source, String(file)).not.toMatch(/state\s*=>\s*state\.isSpectating|state\)\s*=>\s*state\.isSpectating/);
  }
  for (const file of ["left-command-sidebar.tsx", "left-actions-row.tsx"]) {
    const source = readFileSync(join("src/ui/features/world/containers", file), "utf8");
    expect(source).toContain("useUIStore(canIssueOrders)");
    expect(source).toContain(
      file === "left-command-sidebar.tsx"
        ? "if (!ordersAllowed) return <SpectatorStandings />;"
        : "if (!ordersAllowed) return null;",
    );
  }
});
