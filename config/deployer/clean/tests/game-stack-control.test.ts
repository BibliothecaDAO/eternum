import { describe, expect, test } from "bun:test";
import {
  acquireBlitzGameStackAdmission,
  closeExpiredBlitzGameStack,
  createAwsCliGameStackApiStore,
  failBlitzGameStackProvisioning,
  readActiveBlitzGameStack,
  releaseBlitzGameStackAdmission,
} from "../runtime/aws/game-stack-control";
import { createBlitzAuthChallenge, type GameStack } from "../game-stack";

const GAME_STACK: GameStack = {
  schemaVersion: 1,
  gameStackId: "stack-42",
  deploymentId: "0x4242",
  requesterWallet: "0x1234",
  quoteId: "quote-42",
  presetId: "blitz-open",
  intendedStart: "2026-07-18T13:00:00.000Z",
  intendedEnd: "2026-07-18T14:30:00.000Z",
  readinessDeadline: "2026-07-18T12:45:00.000Z",
  rulesetId: "0x77",
  releaseBundleHash: "0x88",
  protocolLifecycle: "Intent",
  operationalPhase: "reserving",
  createdAt: "2026-07-18T10:20:00.000Z",
  updatedAt: "2026-07-18T10:20:00.000Z",
};

function okAwsCommand(stdout = "") {
  return { status: 0, stdout, stderr: "", signal: null, output: ["", stdout, ""], pid: 42 } as never;
}

function failedAwsCommand(stderr: string) {
  return { status: 255, stdout: "", stderr, signal: null, output: ["", "", stderr], pid: 42 } as never;
}

describe("authoritative Blitz game-stack admission", () => {
  test("persists authentication challenges and quotes in the authoritative control table", async () => {
    const calls: string[][] = [];
    const challenge = createBlitzAuthChallenge({
      challengeId: "0x42",
      requesterWallet: "0x1234",
      action: "create-launch-quote",
      payload: { presetId: "blitz-open" },
      now: new Date("2026-07-18T10:20:00.000Z"),
    });
    const store = createAwsCliGameStackApiStore(
      (args) => {
        calls.push(args);
        return okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        now: () => new Date("2026-07-18T10:20:00.000Z"),
      },
    );

    await store.saveChallenge(challenge);
    await store.consumeChallengeAndSaveQuote("0x42", {
      schemaVersion: 1,
      quoteId: "0x99",
      requesterWallet: "0x1234",
      presetId: "blitz-open",
      durationSeconds: 5_400,
      twoPlayerMode: false,
      intendedStart: "2026-07-18T13:00:00.000Z",
      intendedEnd: "2026-07-18T14:30:00.000Z",
      readinessDeadline: "2026-07-18T12:45:00.000Z",
      expiresAt: "2026-07-18T10:50:00.000Z",
    });

    expect(calls.map((call) => call.slice(0, 2))).toEqual([
      ["dynamodb", "put-item"],
      ["dynamodb", "transact-write-items"],
    ]);
    const challengeItem = JSON.parse(calls[0]?.[calls[0].indexOf("--item") + 1] ?? "{}");
    expect(challengeItem.ControlKey.S).toBe("AUTH#0x42");
    expect(challengeItem.MessageHash.S).toBe(challenge.messageHash);
    const transaction = JSON.parse(calls[1]?.[calls[1].indexOf("--transact-items") + 1] ?? "[]");
    expect(transaction[0].Update.ConditionExpression).toContain("attribute_not_exists(ConsumedAt)");
    expect(transaction[1].Put.Item.ControlKey.S).toBe("QUOTE#0x99");
  });

  test("atomically consumes authentication and quote records while replacing only an expired admission", () => {
    const calls: string[][] = [];

    acquireBlitzGameStackAdmission(
      (args) => {
        calls.push(args);
        return okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        challengeId: "challenge-42",
        quoteId: "quote-42",
        now: new Date("2026-07-18T10:20:00.000Z"),
        gameStack: GAME_STACK,
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.slice(0, 2)).toEqual(["dynamodb", "transact-write-items"]);
    const transaction = JSON.parse(calls[0]?.[calls[0].indexOf("--transact-items") + 1] ?? "[]");

    expect(transaction).toHaveLength(4);
    expect(transaction[0].Update.Key.ControlKey.S).toBe("AUTH#challenge-42");
    expect(transaction[0].Update.ConditionExpression).toContain("ConsumedAt");
    expect(transaction[1].Update.Key.ControlKey.S).toBe("QUOTE#quote-42");
    expect(transaction[1].Update.ConditionExpression).toContain("ExpiresAtEpochSeconds > :now");
    expect(transaction[2].Put.Item.ControlKey.S).toBe("ADMISSION#mainnet.blitz");
    expect(transaction[2].Put.ConditionExpression).toBe(
      "attribute_not_exists(ControlKey) OR ActiveUntilEpochSeconds <= :now",
    );
    expect(transaction[3].Put.Item.ControlKey.S).toBe("GAME_STACK#stack-42");
  });

  test("reports a deterministic conflict when another transaction owns admission", () => {
    expect(() =>
      acquireBlitzGameStackAdmission(() => failedAwsCommand("TransactionCanceledException: ConditionalCheckFailed"), {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        challengeId: "challenge-42",
        quoteId: "quote-42",
        now: new Date("2026-07-18T10:20:00.000Z"),
        gameStack: GAME_STACK,
      }),
    ).toThrow("Blitz launch admission was rejected because its challenge, quote, or playable slot is no longer valid");
  });

  test("releases admission only when it still belongs to the failed stack", () => {
    const calls: string[][] = [];
    releaseBlitzGameStackAdmission(
      (args) => {
        calls.push(args);
        return okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        gameStackId: "stack-42",
      },
    );

    const args = calls[0] ?? [];
    expect(args[args.indexOf("--condition-expression") + 1]).toBe("GameStackId = :gameStackId");
    expect(JSON.parse(args[args.indexOf("--expression-attribute-values") + 1])).toEqual({
      ":gameStackId": { S: "stack-42" },
    });
  });

  test("persists structured failure even when a newer stack prevents admission release", () => {
    const calls: string[][] = [];
    failBlitzGameStackProvisioning(
      (args) => {
        calls.push(args);
        return calls.length === 2 ? failedAwsCommand("ConditionalCheckFailedException") : okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        gameStack: {
          ...GAME_STACK,
          protocolLifecycle: "ProvisioningAborted",
          operationalPhase: "failed",
          failure: {
            classification: "provisioning-dispatch",
            message: "workflow unavailable",
            failedAt: "2026-07-18T10:21:00.000Z",
            retryable: true,
            step: "start-provisioning",
          },
        },
      },
    );

    expect(calls.map((call) => call.slice(0, 2))).toEqual([
      ["dynamodb", "update-item"],
      ["dynamodb", "delete-item"],
    ]);
    const failureValues = JSON.parse(calls[0]?.[calls[0].indexOf("--expression-attribute-values") + 1] ?? "{}");
    expect(failureValues[":failureJson"].S).toContain("provisioning-dispatch");
    expect(calls[1]?.[calls[1].indexOf("--condition-expression") + 1]).toBe("GameStackId = :gameStackId");
  });

  test("does not expose an expired admission as the active game", () => {
    const expiredItem = JSON.stringify({
      Item: {
        GameStackId: { S: "stack-old" },
        ActiveUntilEpochSeconds: { N: "1784372400" },
      },
    });

    const active = readActiveBlitzGameStack(() => okAwsCommand(expiredItem), {
      tableName: "runtime-control",
      region: "us-east-2",
      environmentId: "mainnet.blitz",
      now: new Date("2026-07-18T14:30:00.000Z"),
    });

    expect(active).toBeUndefined();
  });

  test("removes the active alias before conditionally releasing expired admission", async () => {
    const actions: string[] = [];

    await closeExpiredBlitzGameStack(
      (args) => {
        actions.push(args.slice(0, 2).join(" "));
        const condition = args[args.indexOf("--condition-expression") + 1];
        expect(condition).toBe("GameStackId = :gameStackId AND ActiveUntilEpochSeconds <= :now");
        return okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        gameStackId: "stack-old",
        activeUntil: "2026-07-18T14:30:00.000Z",
        publicationRevision: 42,
        now: new Date("2026-07-18T14:30:00.000Z"),
      },
      async (identity) => {
        expect(identity).toEqual({
          gameStackId: "stack-old",
          activeUntil: "2026-07-18T14:30:00.000Z",
          publicationRevision: 42,
        });
        actions.push(`remove-alias ${identity.gameStackId}`);
        return true;
      },
    );

    expect(actions).toEqual(["remove-alias stack-old", "dynamodb delete-item"]);
  });

  test("does not release admission when a newer publication makes closure stale", async () => {
    let awsCommandCalled = false;

    const result = await closeExpiredBlitzGameStack(
      () => {
        awsCommandCalled = true;
        return okAwsCommand();
      },
      {
        tableName: "runtime-control",
        region: "us-east-2",
        environmentId: "mainnet.blitz",
        gameStackId: "stack-old",
        activeUntil: "2026-07-18T14:30:00.000Z",
        publicationRevision: 42,
        now: new Date("2026-07-18T14:30:00.000Z"),
      },
      async () => false,
    );

    expect(result).toMatchObject({ aliasRemoved: false, admissionReleased: false });
    expect(awsCommandCalled).toBeFalse();
  });
});
