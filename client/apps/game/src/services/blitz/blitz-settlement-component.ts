import { Has } from "@dojoengine/recs";

type BlitzSettlementComponent = Parameters<typeof Has>[0];

export const resolveBlitzSettlementComponent = (components: unknown): BlitzSettlementComponent | null =>
  (components as { BlitzSettlement?: BlitzSettlementComponent }).BlitzSettlement ?? null;
