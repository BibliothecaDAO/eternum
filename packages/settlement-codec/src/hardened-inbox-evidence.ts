import { hash, shortString } from "starknet";
import hardenedInboxEvidenceJson from "../schema/hardened-inbox-a16-v1.json";

const STARKNET_STATE_V0 = shortString.encodeShortString("STARKNET_STATE_V0");
const EXPECTED_PROTOCOL_REGISTRY_HASH = "0x3c0d5bcc57346e38b6ddf4dc41f9c6f2c65e2094b42985a10c959402e7d9a1c";

const EXPECTED_RUNTIME = {
  package: "settlement_appchain",
  contract: "HardenedInboxRuntimeSpike",
  interface: "IHardenedInboxRuntime",
  upgradeable: false,
  proofArrayBoundsEnforcedBeforeDecode: true,
  finalizedHeadersMustExtendStoredTip: true,
  storageProofRequiresStoredFinalizedHeader: true,
  cancelledSlotsConsumeInNonceOrder: true,
  exactReplayOnly: true,
  seasonIngressCallbackPrecedesCursorCommit: true,
} as const;

const EXPECTED_PROOF_MODEL = {
  trieHeight: 251,
  contractHash: "Pedersen(class_hash, storage_root, nonce, contract_state_hash_version)",
  stateCommitment: "Poseidon(STARKNET_STATE_V0, contracts_root, classes_root)",
  storageKey: "storage_base_address(Pedersen(cancelled_marker_storage_base, transport_nonce))",
  storageValue: "Poseidon(INBOX_CANCELLED_V1, serialized CancelledInboxMarker)",
  layoutIdentity:
    "Poseidon(INBOX_CANCELLED_V1, hardened_piltover_l1, expected_class_hash, cancelled_marker_storage_base)",
} as const;

const EXPECTED_BLOCKER_IDS = [
  "production-recursive-finality-source-absent",
  "finalized-cancelled-slot-fixture-absent",
  "public-piltover-layout-incompatible",
  "production-cost-campaign-absent",
] as const;

const EXPECTED_EXTERNAL_SOURCE_PINS = {
  starknetRpcSpec: {
    repository: "https://github.com/starkware-libs/starknet-specs.git",
    commit: "95acf0cb23f0967903c559d151a19ef5c3fac0fb",
    treeHash: "9bf952dc0358beab0a85f41860d80be90511fbbf",
    version: "0.10.4-rc.0",
    file: "api/starknet_api_openrpc.json",
    fileSha256: "5cf55377416b1a578ca139ecedcaf3d8f5f22db1f7f18c20c85b78c9fb517a34",
  },
  publicPiltover: {
    repository: "https://github.com/cartridge-gg/piltover.git",
    commit: "563f6a10184d97c1168ea0f892c4f132ae4d927c",
    treeHash: "738f43ecc0ce6ab4c868533990ccb62a50626154",
    file: "src/messaging/component.cairo",
    fileSha256: "43387750bf8fdeee47cdf218e1e238e0a9fce3f408c5d1cb376fea1961f48dda",
    cancellationIdentity: "message-hash-status",
    containsCancelledInboxMarker: false,
    containsInboxCancelledV1: false,
  },
} as const;

const EXPECTED_PUBLIC_FIXTURE = {
  network: "SN_SEPOLIA",
  blockNumber: 12177826,
  blockHash: "0x562d0d576b0b4552f5e4f4645db79e365a16ea7d64c425b5aab289c3369a202",
  stateRoot: "0x790a64c9fa7815bbd3435146bc940af66dad9105850a5cdcfe443937203fad8",
  piltoverAddress: "0x6e1745e4c94abba8bf4dbde2b4d10f2e26495a085f451422e3ea52ba90950a1",
  piltoverClassHash: "0x28078dda04ff5d0cc6e361d7c3ce22e6f8855655cee15ff387aa7d9e2a5716f",
  contractNodeCount: 22,
  contractLeaf: "0x2a988a29d5c602ebbb17e68132435c5e43e92c2c6b26e43d12ef0c0b79228f0",
  contractsRoot: "0x5ec8f3e415abf4e31d6ff8c66826c99842d0c1034cb88da02dcacd179aaef57",
  classesRoot: "0x66db14fed264333f9cae1ca52d9e467ac1706193ccf73b59c5beaac5a54736a",
} as const;

const EXPECTED_RPC_OBSERVATION = {
  kind: "rpc-block-status-only",
  observedAt: "2026-07-22T20:58:56Z",
  rpcUrl: "https://api.cartridge.gg/x/starknet/sepolia/rpc/v0_9",
  rpcSpecVersion: "0.9.0",
  productionRecursiveFinalityVerified: false,
} as const;

const EXPECTED_STORAGE_PROOF_REPLAY = {
  method: "starknet_getStorageProof",
  result: "error",
  errorCode: 42,
  errorMessage: "The node doesn't support storage proofs for blocks that are too far in the past",
  durableArchiveAvailable: false,
} as const;

const EXPECTED_TEST_EVIDENCE = {
  command: "snforge test hardened_inbox_runtime_tests",
  runner: {
    scarbVersion: "2.13.1",
    scarbBuildCommit: "a76aed717",
    cairoVersion: "2.13.1",
    sierraVersion: "1.7.0",
    snforgeVersion: "0.56.0",
    snforgeStdVersion: "0.51.2",
  },
  focusedTests: 26,
  focusedPassed: 26,
  focusedFailed: 0,
  focusedFilteredOut: 28,
  positiveApplyReplayL2Gas: 4_786_614,
  capturedContractProofL2Gas: 1_082_878,
  productionRecursiveFinalityVerifyL2Gas: null,
  productionMaximumStorageProofL2Gas: null,
} as const;

const EXPECTED_REPRODUCIBILITY_INPUTS = {
  manifestSha256: "cdf4d7f447583d7e12b9f6de0a56008e55250ed794070b5569b8e35d5dd1d4c8",
  lockfileSha256: "ba18bae0bbb173fce6b881d956eee4452df9d8875fa472993e54ff90ce65f32d",
  runtimeSha256: "74d394e1ba922e93f460518bf0ed2e957ea444905e3d0bed4bff24186c0c38c1",
  testsAndCapturedProofSha256: "bcfe643eccc7259bfafec1e56661f250397db04de170d490b6c09eff720d5ef1",
  testMocksSha256: "8397e27f9ae8afe53d7ff497809a851bcf6ed190fa6851b411104f5cf7379518",
  protocolInterfacesSha256: "2231a513200f661ad666adc24225c4c486899a597a66db7365f19abaf936ed62",
  protocolTypesSha256: "64ee1230b9d5bdc1b2854952b14b3fc1874cc1788f347f6dddf589a524e2a955",
} as const;

export interface HardenedInboxEvidence {
  version: number;
  ticket: "A16";
  status: "reference-runtime-and-public-patricia-proof-complete-production-finality-blocked";
  releaseReady: boolean;
  protocolRegistryHash: string;
  runtime: typeof EXPECTED_RUNTIME;
  proofModel: typeof EXPECTED_PROOF_MODEL;
  externalSourcePins: typeof EXPECTED_EXTERNAL_SOURCE_PINS;
  publicPatriciaEvidence: {
    status: "contract-proof-only-block-now-rpc-accepted-on-l1";
    network: "SN_SEPOLIA";
    blockNumber: number;
    blockHash: string;
    finalityStatus: "ACCEPTED_ON_L1";
    piltoverAddress: string;
    piltoverClassHash: string;
    contractNodeCount: number;
    contractLeaf: string;
    contractsRoot: string;
    classesRoot: string;
    stateRoot: string;
    containsCancelledMarkerStorageProof: boolean;
    rpcObservation: {
      kind: "rpc-block-status-only";
      observedAt: string;
      rpcUrl: string;
      rpcSpecVersion: string;
      productionRecursiveFinalityVerified: boolean;
    };
    historicalStorageProofReplay: {
      method: "starknet_getStorageProof";
      result: "error";
      errorCode: number;
      errorMessage: string;
      durableArchiveAvailable: boolean;
    };
  };
  testEvidence: {
    command: string;
    runner: {
      scarbVersion: string;
      scarbBuildCommit: string;
      cairoVersion: string;
      sierraVersion: string;
      snforgeVersion: string;
      snforgeStdVersion: string;
    };
    focusedTests: number;
    focusedPassed: number;
    focusedFailed: number;
    focusedFilteredOut: number;
    positiveApplyReplayL2Gas: number;
    capturedContractProofL2Gas: number;
    productionRecursiveFinalityVerifyL2Gas: number | null;
    productionMaximumStorageProofL2Gas: number | null;
  };
  reproducibilityInputs: Record<keyof typeof EXPECTED_REPRODUCIBILITY_INPUTS, string>;
  mandatoryBlockers: Array<{ id: string; reason: string }>;
}

const EVIDENCE = hardenedInboxEvidenceJson as unknown as HardenedInboxEvidence;

export function getHardenedInboxEvidence(): HardenedInboxEvidence {
  return structuredClone(EVIDENCE);
}

export function validateHardenedInboxEvidence(evidence: HardenedInboxEvidence): void {
  validateReleaseState(evidence);
  requireDeepEqual(evidence.runtime, EXPECTED_RUNTIME, "runtime contract");
  requireDeepEqual(evidence.proofModel, EXPECTED_PROOF_MODEL, "proof model");
  validateExternalSourcePins(evidence.externalSourcePins);
  validateRpcOnlyPublicEvidence(evidence.publicPatriciaEvidence);
  requireDeepEqual(evidence.testEvidence, EXPECTED_TEST_EVIDENCE, "test evidence");
  requireDeepEqual(evidence.reproducibilityInputs, EXPECTED_REPRODUCIBILITY_INPUTS, "reproducibility inputs");
  validateMandatoryBlockers(evidence.mandatoryBlockers);
}

function validateReleaseState(evidence: HardenedInboxEvidence): void {
  requireEqual(evidence.version, 1, "version");
  requireEqual(evidence.ticket, "A16", "ticket");
  requireEqual(
    evidence.status,
    "reference-runtime-and-public-patricia-proof-complete-production-finality-blocked",
    "status",
  );
  requireEqual(evidence.releaseReady, false, "releaseReady");
  requireEqual(evidence.protocolRegistryHash, EXPECTED_PROTOCOL_REGISTRY_HASH, "protocol registry hash");
}

function validateExternalSourcePins(pins: HardenedInboxEvidence["externalSourcePins"]): void {
  requireDeepEqual(pins, EXPECTED_EXTERNAL_SOURCE_PINS, "external source pins");
}

function validateRpcOnlyPublicEvidence(evidence: HardenedInboxEvidence["publicPatriciaEvidence"]): void {
  requireEqual(evidence.status, "contract-proof-only-block-now-rpc-accepted-on-l1", "public proof status");
  requireEqual(evidence.network, EXPECTED_PUBLIC_FIXTURE.network, "public fixture network");
  requireEqual(evidence.blockNumber, EXPECTED_PUBLIC_FIXTURE.blockNumber, "public fixture block number");
  requireEqual(evidence.blockHash, EXPECTED_PUBLIC_FIXTURE.blockHash, "public fixture block hash");
  requireEqual(evidence.stateRoot, EXPECTED_PUBLIC_FIXTURE.stateRoot, "public fixture state root");
  requireEqual(evidence.piltoverAddress, EXPECTED_PUBLIC_FIXTURE.piltoverAddress, "public fixture address");
  requireEqual(evidence.piltoverClassHash, EXPECTED_PUBLIC_FIXTURE.piltoverClassHash, "public fixture class hash");
  requireEqual(evidence.contractNodeCount, EXPECTED_PUBLIC_FIXTURE.contractNodeCount, "public fixture proof nodes");
  requireEqual(evidence.contractLeaf, EXPECTED_PUBLIC_FIXTURE.contractLeaf, "public fixture contract leaf");
  requireEqual(evidence.contractsRoot, EXPECTED_PUBLIC_FIXTURE.contractsRoot, "public fixture contracts root");
  requireEqual(evidence.classesRoot, EXPECTED_PUBLIC_FIXTURE.classesRoot, "public fixture classes root");
  validatePublicStateCommitment(evidence);
  requireEqual(evidence.finalityStatus, "ACCEPTED_ON_L1", "observed block finality status");
  requireDeepEqual(evidence.rpcObservation, EXPECTED_RPC_OBSERVATION, "RPC observation");
  requireEqual(evidence.containsCancelledMarkerStorageProof, false, "cancelled marker storage proof claim");
  requireDeepEqual(evidence.historicalStorageProofReplay, EXPECTED_STORAGE_PROOF_REPLAY, "storage proof replay");
}

function validatePublicStateCommitment(evidence: HardenedInboxEvidence["publicPatriciaEvidence"]): void {
  const stateCommitment = hash.computePoseidonHashOnElements([
    STARKNET_STATE_V0,
    evidence.contractsRoot,
    evidence.classesRoot,
  ]);
  requireEqual(BigInt(evidence.stateRoot), BigInt(stateCommitment), "public fixture state commitment");
}

function validateMandatoryBlockers(blockers: HardenedInboxEvidence["mandatoryBlockers"]): void {
  requireDeepEqual(
    blockers.map(({ id }) => id),
    EXPECTED_BLOCKER_IDS,
    "mandatory blocker IDs",
  );
  for (const blocker of blockers) {
    requireNonBlank(blocker.reason, `mandatory blocker ${blocker.id} reason`);
  }
}

function requireEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label} mismatch: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function requireDeepEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch`);
  }
}

function requireNonBlank(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be non-blank`);
  }
}
