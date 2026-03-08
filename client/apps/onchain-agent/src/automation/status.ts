import type { TickResult } from "./executor.js";

export interface RealmStatus {
  realmEntityId: number;
  realmName: string;
  biome: number;
  level: number;
  buildOrderProgress: string;
  tickResult: TickResult;
  essencePulse: { balance: number; sufficient: boolean };
  wheatPulse: { balance: number; low: boolean };
}

export interface StatusInput {
  timestamp: Date;
  realms: RealmStatus[];
}

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
