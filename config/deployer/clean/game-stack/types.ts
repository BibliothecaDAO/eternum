export type PublicBlitzPresetId = "blitz-fast" | "blitz-open" | "blitz-duel";

export interface BlitzLaunchQuote {
  schemaVersion: 1;
  quoteId: string;
  requesterWallet: string;
  presetId: PublicBlitzPresetId;
  durationSeconds: number;
  twoPlayerMode: boolean;
  intendedStart: string;
  intendedEnd: string;
  readinessDeadline: string;
  expiresAt: string;
}

export type GameStackProtocolLifecycle =
  | "Intent"
  | "IntentExpired"
  | "AcceptanceBuilding"
  | "Provisioning"
  | "ProvisioningIdentitySealed"
  | "Attested"
  | "Active"
  | "IngressClosed"
  | "GameFrozen"
  | "Finalizing"
  | "FinalRootsSealed"
  | "FinalCheckpoint"
  | "OutcomesRegistered"
  | "ClaimsOpen"
  | "Draining"
  | "DormantMaterialized"
  | "Retired"
  | "ProvisioningAborted"
  | "ExitChallenge"
  | "EmergencyFrozen"
  | "ExitOnly";

export type GameStackOperationalPhase =
  | "reserving"
  | "provisioning-l3"
  | "deploying-world"
  | "provisioning-indexer"
  | "ready"
  | "active"
  | "settling"
  | "closed"
  | "failed";

export interface GameStackFailure {
  classification: string;
  message: string;
  failedAt: string;
  retryable: boolean;
  step?: string;
}

export interface GameStackRuntimeIdentity {
  runtimeName: string;
  runtimeInstanceId: string;
  imageDigest: string;
  routingShard?: number;
  endpoints?: Partial<Record<"base" | "health" | "rpc" | "sql", string>>;
}

export function deriveGameStackOperationalPhase(
  lifecycle: GameStackProtocolLifecycle,
  hasFailure = false,
): GameStackOperationalPhase {
  if (hasFailure || lifecycle === "IntentExpired" || lifecycle === "ProvisioningAborted") return "failed";
  if (lifecycle === "Intent" || lifecycle === "AcceptanceBuilding") return "reserving";
  if (lifecycle === "Provisioning") return "provisioning-l3";
  if (lifecycle === "ProvisioningIdentitySealed" || lifecycle === "Attested") return "ready";
  if (lifecycle === "Active") return "active";
  if (lifecycle === "DormantMaterialized" || lifecycle === "Retired") return "closed";
  return "settling";
}

export interface GameStack {
  schemaVersion: 1;
  gameStackId: string;
  deploymentId: string;
  requesterWallet: string;
  quoteId: string;
  presetId: PublicBlitzPresetId;
  intendedStart: string;
  intendedEnd: string;
  readinessDeadline: string;
  rulesetId: string;
  releaseBundleHash: string;
  l3ChainId?: string;
  settlementIdentity?: string;
  attestationMeasurement?: string;
  katana?: GameStackRuntimeIdentity;
  torii?: GameStackRuntimeIdentity;
  protocolLifecycle: GameStackProtocolLifecycle;
  operationalPhase: GameStackOperationalPhase;
  failure?: GameStackFailure;
  createdAt: string;
  updatedAt: string;
}

export type FailedGameStack = GameStack & {
  operationalPhase: "failed";
  failure: GameStackFailure;
};
