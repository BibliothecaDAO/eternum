/**
 * Automation status formatter — converts per-realm tick results into a human-readable report.
 *
 * Returns a formatted string. The caller (automation loop) is responsible for
 * writing it to disk.
 */
import type { TickResult } from "./executor.js";

/** Aggregated status for a single realm after one automation tick. */
export interface RealmStatus {
  /** On-chain entity ID of the realm. */
  realmEntityId: number;
  /** Display name used in status output (e.g. "Realm 42"). */
  realmName: string;
  /** Biome numeric value of the realm's home tile. */
  biome: number;
  /** Current realm level (0=Settlement … 3=Empire). */
  level: number;
  /** Human-readable build order progress string (e.g. "5/44"). */
  buildOrderProgress: string;
  /** Result of the on-chain tick execution for this realm. */
  tickResult: TickResult;
  /** Essence balance and whether it covers the next milestone cost. */
  essencePulse: { balance: number; sufficient: boolean };
  /** Wheat balance and whether it is critically low. */
  wheatPulse: { balance: number; low: boolean };
}

interface StatusInput {
  timestamp: Date;
  realms: RealmStatus[];
}

/**
 * Format a multi-realm automation status report as a plain-text string.
 *
 * @param input - Timestamp and per-realm status data to render.
 * @returns A newline-separated status report ready for writing to a file or logging.
 */
export function formatStatus(input: StatusInput): string {
  const lines: string[] = [];
  lines.push(`=== Automation Status ===`);
  lines.push(`Last tick: ${input.timestamp.toISOString()}`);
  lines.push(`Realms: ${input.realms.length}`);
  lines.push("");

  for (const realm of input.realms) {
    const r = realm.tickResult;
    lines.push(`--- ${realm.realmName} (entity ${realm.realmEntityId}) ---`);
    lines.push(`Level: ${realm.level} | Build order: ${realm.buildOrderProgress}`);

    if (r.built.length > 0) lines.push(`Built: ${r.built.join(", ")}`);
    if (r.upgraded) lines.push(`Upgraded: ${r.upgraded}`);
    lines.push(`Production: ${r.produced ? "executed" : "skipped"}`);
    if (r.idle) lines.push(`Status: Idle`);

    const ess = realm.essencePulse;
    lines.push(`Essence: ${ess.balance}${ess.sufficient ? "" : " (INSUFFICIENT)"}`);
    const wh = realm.wheatPulse;
    lines.push(`Wheat: ${wh.balance}${wh.low ? " LOW" : ""}`);

    if (r.errors.length > 0) {
      lines.push(`Errors: ${r.errors.join("; ")}`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
