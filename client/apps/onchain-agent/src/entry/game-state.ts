import type { MapContext } from "../map/context.js";
import type { AutomationStatusMap } from "../automation/status.js";

export interface ToolError {
  tool: string;
  error: string;
  tick: number;
}

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.floor(n));
}

export function buildGameStateBlock(
  mapCtx: MapContext,
  automationStatus: AutomationStatusMap,
  toolErrors: ToolError[],
): string {
  const sections: string[] = ["<game_state>"];

  // Structures
  sections.push("<structures>");
  if (automationStatus.size === 0) {
    sections.push("  No structures tracked yet.");
  } else {
    for (const s of automationStatus.values()) {
      const errs = s.errors.length > 0 ? ` | ERRORS: ${s.errors[0]}` : "";
      sections.push(
        `  ${s.name} | lv${s.level} | build ${s.buildOrderProgress} | Wheat: ${formatBalance(s.wheatBalance)}, Essence: ${formatBalance(s.essenceBalance)}${errs}`,
      );
    }
  }
  sections.push("</structures>");

  // Armies from map snapshot
  sections.push("<armies>");
  const snapshot = mapCtx.snapshot;
  if (!snapshot || !snapshot.explorerDetails || snapshot.explorerDetails.size === 0) {
    sections.push("  No armies visible.");
  } else {
    for (const [entityId, info] of snapshot.explorerDetails) {
      const tile = snapshot.tiles.find((t: any) => t.occupierId === entityId);
      if (!tile) continue;
      const troops = (info as any).troops ?? [];
      const troopStr =
        troops.length > 0
          ? troops.map((t: any) => `${t.count?.toLocaleString() ?? "?"} ${t.name ?? "troops"}`).join(", ")
          : "unknown troops";
      const stam = (info as any).stamina != null ? ` | stamina ${(info as any).stamina}` : "";
      sections.push(`  army ${entityId} | ${troopStr}${stam}`);
    }
  }
  sections.push("</armies>");

  // Automation
  sections.push("<automation>");
  if (automationStatus.size === 0) {
    sections.push("  No automation data yet.");
  } else {
    for (const s of automationStatus.values()) {
      const parts: string[] = [];
      if (s.lastBuilt.length > 0) parts.push(`built ${s.lastBuilt.join(", ")}`);
      if (s.lastUpgrade) parts.push(`upgraded ${s.lastUpgrade}`);
      if (s.produced) parts.push("production ran");
      if (parts.length === 0) parts.push("idle");
      sections.push(`  ${s.name}: ${parts.join(", ")}`);
    }
  }
  sections.push("</automation>");

  // Tool errors
  if (toolErrors.length > 0) {
    sections.push("<tool_errors>");
    const grouped = new Map<string, { count: number; lastError: string }>();
    for (const e of toolErrors) {
      const entry = grouped.get(e.tool);
      if (entry) {
        entry.count++;
        entry.lastError = e.error;
      } else {
        grouped.set(e.tool, { count: 1, lastError: e.error });
      }
    }
    for (const [tool, { count, lastError }] of grouped) {
      sections.push(`  ${tool} ${count}x: ${lastError}`);
    }
    sections.push("</tool_errors>");
  }

  sections.push("</game_state>");
  return sections.join("\n");
}
