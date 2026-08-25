import type { RendererActiveMode } from "../renderer-backend-v2";
import type { ArmyRenderViolation } from "./army-slot-auditor";

interface ReportArmyIntegrityHealInput {
  rendererMode: RendererActiveMode | null;
  reportedSignatures: Set<string>;
  violation: ArmyRenderViolation;
  warn?: (message: string) => void;
}

export function reportArmyIntegrityHealOnce(input: ReportArmyIntegrityHealInput): boolean {
  const signature = buildArmyIntegrityHealSignature(input.violation);
  if (input.reportedSignatures.has(signature)) {
    return false;
  }

  input.reportedSignatures.add(signature);
  const warn = input.warn ?? console.warn;
  warn(
    `[ArmyManager] render-integrity-heal renderer_mode=${input.rendererMode ?? "uninitialized"} heal_signature=${signature} violation_kind=${input.violation.kind}`,
  );
  return true;
}

function buildArmyIntegrityHealSignature(violation: ArmyRenderViolation): string {
  switch (violation.kind) {
    case "orphaned-drawn-slot":
      return `orphan:${violation.slot}:${violation.owner}`;
    case "visible-not-drawn":
      return `missing:${violation.entityId}`;
    case "stale-drawn-position":
      return `stale:${violation.entityId}:${violation.slot}`;
    case "duplicate-drawn-owner":
      return `dup:${violation.owner}:${violation.slots.join(",")}`;
  }
}
