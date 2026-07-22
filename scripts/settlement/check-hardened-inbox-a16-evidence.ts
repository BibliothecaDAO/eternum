import {
  getHardenedInboxEvidence,
  validateHardenedInboxEvidence,
} from "../../packages/settlement-codec/src/hardened-inbox-evidence";

const evidence = getHardenedInboxEvidence();
validateHardenedInboxEvidence(evidence);

process.stdout.write(
  `${JSON.stringify({
    ticket: evidence.ticket,
    status: evidence.status,
    releaseReady: evidence.releaseReady,
    observedFinalityStatus: evidence.publicPatriciaEvidence.finalityStatus,
    observationKind: evidence.publicPatriciaEvidence.rpcObservation.kind,
    contractLeaf: evidence.publicPatriciaEvidence.contractLeaf,
    contractsRoot: evidence.publicPatriciaEvidence.contractsRoot,
    classesRoot: evidence.publicPatriciaEvidence.classesRoot,
    stateRoot: evidence.publicPatriciaEvidence.stateRoot,
    productionRecursiveFinalityVerified:
      evidence.publicPatriciaEvidence.rpcObservation.productionRecursiveFinalityVerified,
    containsCancelledMarkerStorageProof: evidence.publicPatriciaEvidence.containsCancelledMarkerStorageProof,
    storageProofReplayErrorCode: evidence.publicPatriciaEvidence.historicalStorageProofReplay.errorCode,
    mandatoryBlockerCount: evidence.mandatoryBlockers.length,
  })}\n`,
);
