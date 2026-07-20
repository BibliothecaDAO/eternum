import { describe, expect, it } from "vitest";
import {
  hashDeploymentRefundMaterializationJournal,
  hashFrozenRecoveryJournal,
  hashPositionMaterializationJournal,
  verifyDeploymentRefundMaterializationJournal,
  verifyFrozenRecoveryJournal,
  verifyPositionMaterializationJournal,
} from "./frozen-recovery";

const RECOVERY_HASH = 0x40aea6316d38fddec50d6a2ba770a77babc95603c124e2ba6356644004b5afan;
const DEPLOYMENT_HASH = 0x4aaed4fdfc7127f25f78d7b21d6875604cb2173fdbaf4f89656644f5ab7e43dn;
const POSITION_HASH = 0x1f0cfc118469d26eac0b3d226cf0af1edf09eb6051e1d39ef0e15d6d1f9d9e2n;

describe("A21 public journals", () => {
  it("matches the frozen Rust and Cairo vectors", () => {
    expect(hashFrozenRecoveryJournal(recoveryJournal())).toBe(RECOVERY_HASH);
    expect(hashDeploymentRefundMaterializationJournal(deploymentJournal())).toBe(DEPLOYMENT_HASH);
    expect(hashPositionMaterializationJournal(positionJournal())).toBe(POSITION_HASH);
  });

  it("rejects changed recovery and materialization outputs", () => {
    expect(verifyFrozenRecoveryJournal(recoveryJournal(), RECOVERY_HASH)).toBe(true);
    expect(verifyFrozenRecoveryJournal({ ...recoveryJournal(), routesHash: 3008n }, RECOVERY_HASH)).toBe(false);
    expect(verifyDeploymentRefundMaterializationJournal(deploymentJournal(), DEPLOYMENT_HASH)).toBe(true);
    expect(
      verifyDeploymentRefundMaterializationJournal(
        { ...deploymentJournal(), terminalRefundSourceHash: 4008n },
        DEPLOYMENT_HASH,
      ),
    ).toBe(false);
    expect(verifyPositionMaterializationJournal(positionJournal(), POSITION_HASH)).toBe(true);
    expect(verifyPositionMaterializationJournal({ ...positionJournal(), chunkRoot: 5008n }, POSITION_HASH)).toBe(false);
  });
});

function recoveryJournal() {
  return {
    programHash: 3001n,
    stateRoot: 3002n,
    summaryHash: 3003n,
    sourcesHash: 3004n,
    dispositionsHash: 3005n,
    gameReturnsHash: 3006n,
    routesHash: 3007n,
  };
}

function deploymentJournal() {
  return {
    programHash: 4001n,
    terminalRefundSourceHash: 4002n,
    recoveryJournalHash: 4003n,
    verifiedOutputHash: 4004n,
    chunkRoot: 4005n,
    livePreimagesHash: 4006n,
    liveTotalsHash: 4007n,
  };
}

function positionJournal() {
  return {
    programHash: 5001n,
    verifiedOutputHash: 5002n,
    chunkRoot: 5003n,
    livePreimagesHash: 5004n,
    liveTotalsHash: 5005n,
  };
}
