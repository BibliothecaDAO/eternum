import {
  normalizeProceduralImpact,
  type ProceduralCombatImpactRecord,
  type ProceduralImpactAuthority,
  type ProceduralUnitImpact,
} from "../characters/collision/procedural-impact";

export interface CombatImpactRegistryStats {
  activeCount: number;
  consumedCount: number;
  expiredCount: number;
  recordedCount: number;
}

const DEFAULT_TTL_SECONDS = 8;

/** One expiring, presentation-only impact per target. It never carries gameplay outcome state. */
export class CombatImpactRegistry {
  private readonly records = new Map<number, ProceduralCombatImpactRecord>();
  private recordedCount = 0;
  private consumedCount = 0;
  private expiredCount = 0;

  public constructor(private readonly ttlSeconds = DEFAULT_TTL_SECONDS) {}

  public record(input: {
    authority: ProceduralImpactAuthority;
    impact: ProceduralUnitImpact;
    nowSeconds: number;
    targetEntityId: number;
  }): void {
    if (!Number.isInteger(input.targetEntityId)) return;
    const now = normalizeTime(input.nowSeconds);
    this.records.set(input.targetEntityId, {
      ...normalizeProceduralImpact(input.impact),
      authority: input.authority,
      expiresAtSeconds: now + normalizeTtl(this.ttlSeconds),
      targetEntityId: input.targetEntityId,
    });
    this.recordedCount += 1;
  }

  public consume(targetEntityId: number, nowSeconds: number): ProceduralCombatImpactRecord | undefined {
    const record = this.records.get(targetEntityId);
    if (!record) return undefined;
    this.records.delete(targetEntityId);
    if (record.expiresAtSeconds < normalizeTime(nowSeconds)) {
      this.expiredCount += 1;
      return undefined;
    }
    this.consumedCount += 1;
    return cloneRecord(record);
  }

  public prune(nowSeconds: number): void {
    const now = normalizeTime(nowSeconds);
    this.records.forEach((record, targetEntityId) => {
      if (record.expiresAtSeconds >= now) return;
      this.records.delete(targetEntityId);
      this.expiredCount += 1;
    });
  }

  public remove(targetEntityId: number): void {
    this.records.delete(targetEntityId);
  }

  public getStats(): CombatImpactRegistryStats {
    return {
      activeCount: this.records.size,
      consumedCount: this.consumedCount,
      expiredCount: this.expiredCount,
      recordedCount: this.recordedCount,
    };
  }

  public reset(): void {
    this.records.clear();
    this.recordedCount = 0;
    this.consumedCount = 0;
    this.expiredCount = 0;
  }
}

function cloneRecord(record: ProceduralCombatImpactRecord): ProceduralCombatImpactRecord {
  return { ...record };
}

function normalizeTtl(value: number): number {
  return Number.isFinite(value) ? Math.min(60, Math.max(0.1, value)) : DEFAULT_TTL_SECONDS;
}

function normalizeTime(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
