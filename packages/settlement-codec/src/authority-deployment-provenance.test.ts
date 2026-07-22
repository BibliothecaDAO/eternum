import { describe, expect, test } from "vitest";
import { validateFinalizedMmrDeploymentEvidence } from "../../../scripts/settlement/verify-authority-observation.mjs";
import { getAuthorityInventory } from "./authority-inventory";

describe("A20 finalized MMR deployment provenance", () => {
  test("accepts the exact account-to-UDC call and unique ContractDeployed event", () => {
    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), receipt()),
    ).not.toThrow();
  });

  test("rejects duplicate ContractDeployed events", () => {
    const duplicated = receipt();
    duplicated.events.push(structuredClone(duplicated.events[0]));

    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), duplicated),
    ).toThrow("expected exactly one ContractDeployed event");
  });

  test("rejects a substituted UDC call target or deployment salt", () => {
    const wrongTarget = transaction();
    wrongTarget.calldata[1] = "0x1";
    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), wrongTarget, receipt()),
    ).toThrow("MMR deployment account calldata mismatch");

    const wrongSalt = transaction();
    wrongSalt.calldata[5] = "0x1";
    expect(() => validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), wrongSalt, receipt())).toThrow(
      "MMR deployment account calldata mismatch",
    );
  });

  test("rejects a ContractDeployed event from the wrong emitter", () => {
    const wrongEmitter = receipt();
    wrongEmitter.events[0].from_address = "0x1";

    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), wrongEmitter),
    ).toThrow("MMR ContractDeployed emitter mismatch");
  });

  test("rejects noncanonical ContractDeployed keys", () => {
    const wrongKeys = receipt();
    wrongKeys.events[0].keys.push("0x1");

    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), wrongKeys),
    ).toThrow("MMR ContractDeployed keys mismatch");
  });

  test("rejects a truncated ContractDeployed schema or substituted event salt", () => {
    const truncated = receipt();
    truncated.events[0].data.pop();
    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), truncated),
    ).toThrow("MMR ContractDeployed data length mismatch");

    const wrongSalt = receipt();
    wrongSalt.events[0].data[7] = "0x1";
    expect(() =>
      validateFinalizedMmrDeploymentEvidence(deployment(), contractAddress(), transaction(), wrongSalt),
    ).toThrow("MMR ContractDeployed data mismatch");
  });

  test.each([
    {
      field: "UDC address",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.udc.address = "0x1";
      },
      error: "MMR deployment UDC address mismatch",
    },
    {
      field: "deploy selector",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.udc.deployContractSelector = "0x1";
      },
      error: "MMR deployment selector mismatch",
    },
    {
      field: "salt",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.udc.salt = "0x1";
      },
      error: "MMR deployment salt mismatch",
    },
    {
      field: "unique flag",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.udc.unique = "0x0";
      },
      error: "MMR deployment unique flag mismatch",
    },
    {
      field: "class hash",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.classHash = "0x1";
      },
      error: "MMR deployment class hash mismatch",
    },
    {
      field: "constructor calldata length",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.constructorCalldata.pop();
      },
      error: "MMR deployment constructor calldata mismatch",
    },
    {
      field: "constructor calldata content",
      mutate: (value: ReturnType<typeof deployment>) => {
        value.constructorCalldata[0] = "0x1";
      },
      error: "MMR deployment constructor calldata mismatch",
    },
  ])("rejects a recorded $field mutation when live RPC values are unchanged", ({ mutate, error }) => {
    const recorded = deployment();
    mutate(recorded);

    expect(() => validateFinalizedMmrDeploymentEvidence(recorded, contractAddress(), transaction(), receipt())).toThrow(
      error,
    );
  });

  test("rejects a recorded deployed contract address mutation when live RPC values are unchanged", () => {
    expect(() => validateFinalizedMmrDeploymentEvidence(deployment(), "0x1", transaction(), receipt())).toThrow(
      "MMR deployed contract address mismatch",
    );
  });

  test("rejects recorded event data mutations when live RPC values are unchanged", () => {
    const recorded = deployment();
    recorded.contractDeployedEvent.data[3] = "0x1";

    expect(() => validateFinalizedMmrDeploymentEvidence(recorded, contractAddress(), transaction(), receipt())).toThrow(
      "MMR ContractDeployed data mismatch",
    );
  });
});

function deployment() {
  return structuredClone(
    getAuthorityInventory().onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken")!.deployment,
  );
}

function contractAddress() {
  return getAuthorityInventory().onchainObservations.find(({ semanticKey }) => semanticKey === "mmrToken")!
    .contractAddress;
}

function transaction() {
  return {
    type: "INVOKE",
    transaction_hash: "0x24d64ab4a5355ab00a0c8cf39e25a764cd59009fa2cb7b2d68bd4fd38b8b6d7",
    sender_address: "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
    version: "0x3",
    calldata: [
      "0x1",
      "0x41a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
      "0x1987cbd17808b9a23693d4de7e246a443cfe37e6e7fbaeabd7d7e6532b07c3d",
      "0x6",
      "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
      "0x71f9f9da9b5f8122adf140396ff17244b0d82371906208dcda5bc454a526258",
      "0x1",
      "0x2",
      "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
      "0x7fd490b3ba298e4b94e3c32df832823b102e39ce98cd41076a70b2f82d9326e",
    ],
  };
}

function receipt() {
  return {
    events: [
      {
        from_address: "0x41a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf",
        keys: ["0x26b160f10156dea0639bec90696772c640b9706a47f5b8c52ea1abe5858b34d"],
        data: [
          "0xd5a3c8c5ebcacf3279aafd2de3eb0c4736afc11be6f41c84880080fa7a1aaf",
          "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
          "0x1",
          "0x1dc09743f158d6e650b1b14e9557806c898274a5423ec9857558cabb2b7c1d8",
          "0x2",
          "0x6292eefbff50689b0e4d007e6ad17abee996e08e66e62762f0c4bc170738402",
          "0x7fd490b3ba298e4b94e3c32df832823b102e39ce98cd41076a70b2f82d9326e",
          "0x71f9f9da9b5f8122adf140396ff17244b0d82371906208dcda5bc454a526258",
        ],
      },
    ],
  };
}
