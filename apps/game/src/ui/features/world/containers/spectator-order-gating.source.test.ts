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
  for (const [file, gate] of [
    ["src/ui/features/world/containers/left-command-sidebar.tsx", "if (!ordersAllowed) return <SpectatorStandings />;"],
    ["src/ui/features/world/components/actions/structure-actions-row.tsx", "if (!ordersAllowed) return null;"],
  ]) {
    const source = readFileSync(file, "utf8");
    expect(source).toContain("useUIStore(canIssueOrders)");
    expect(source).toContain(gate);
  }
});
