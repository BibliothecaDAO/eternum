import { GameStackStoreConflictError } from "../../game-stack";
import type { BlitzAuthChallenge, BlitzLaunchQuote, GameStack, GameStackApiStore } from "../../game-stack";
import { buildAwsCommandOutput, parseJsonOutput, runRequiredAwsCommand, type AwsCommandRunner } from "./commands";

const BLITZ_ENVIRONMENT_ID = "mainnet.blitz";
const GAME_STACK_RETENTION_SECONDS = 90 * 24 * 60 * 60;

interface BlitzControlRequest {
  tableName: string;
  region: string;
  environmentId: string;
}

export interface AcquireBlitzGameStackAdmissionRequest extends BlitzControlRequest {
  challengeId: string;
  quoteId: string;
  now?: Date;
  gameStack: GameStack;
}

export interface ReleaseBlitzGameStackAdmissionRequest extends BlitzControlRequest {
  gameStackId: string;
}

export interface FailBlitzGameStackProvisioningRequest extends BlitzControlRequest {
  gameStack: GameStack;
}

export interface PersistBlitzGameStackTransitionRequest extends BlitzControlRequest {
  expected: GameStack;
  next: GameStack;
}

export interface ReadActiveBlitzGameStackRequest extends BlitzControlRequest {
  now?: Date;
}

export interface CloseExpiredBlitzGameStackRequest extends BlitzControlRequest {
  gameStackId: string;
  activeUntil: string;
  publicationRevision: number;
  now?: Date;
}

export type ExpiredBlitzGameStackPublicationIdentity = Pick<
  CloseExpiredBlitzGameStackRequest,
  "gameStackId" | "activeUntil" | "publicationRevision"
>;

export interface CloseExpiredBlitzGameStackResult {
  gameStackId: string;
  activeUntil: string;
  aliasRemoved: boolean;
  admissionReleased: boolean;
}

export interface ActiveBlitzGameStackAdmission {
  gameStackId: string;
  activeUntil: string;
}

export interface AwsCliGameStackApiStoreConfig extends BlitzControlRequest {
  now?: () => Date;
}

export function createAwsCliGameStackApiStore(
  commandRunner: AwsCommandRunner,
  config: AwsCliGameStackApiStoreConfig,
): GameStackApiStore {
  assertMainnetBlitzControlRequest(config);

  return {
    async saveChallenge(challenge) {
      saveAuthenticationChallenge(commandRunner, config, challenge);
    },
    async readChallenge(challengeId) {
      return readControlRecord<BlitzAuthChallenge>(
        commandRunner,
        config,
        buildChallengeKey(challengeId),
        "ChallengeJson",
      );
    },
    async consumeChallengeAndSaveQuote(challengeId, quote) {
      consumeChallengeAndSaveQuote(commandRunner, config, challengeId, quote);
    },
    async readQuote(quoteId) {
      return readControlRecord<BlitzLaunchQuote>(commandRunner, config, buildQuoteKey(quoteId), "QuoteJson");
    },
    async acquireGameStack(challengeId, gameStack) {
      acquireBlitzGameStackAdmission(commandRunner, {
        ...config,
        challengeId,
        quoteId: gameStack.quoteId,
        now: readStoreClock(config),
        gameStack,
      });
    },
    async failGameStack(gameStack) {
      failBlitzGameStackProvisioning(commandRunner, { ...config, gameStack });
    },
    async releaseGameStack(gameStackId) {
      releaseBlitzGameStackAdmission(commandRunner, { ...config, gameStackId });
    },
    async readGameStack(gameStackId) {
      return readControlRecord<GameStack>(commandRunner, config, buildGameStackKey(gameStackId), "GameStackJson");
    },
    async readActiveGameStack() {
      const admission = readActiveBlitzGameStack(commandRunner, { ...config, now: readStoreClock(config) });
      if (!admission) return undefined;
      return readControlRecord<GameStack>(
        commandRunner,
        config,
        buildGameStackKey(admission.gameStackId),
        "GameStackJson",
      );
    },
  };
}

export function acquireBlitzGameStackAdmission(
  commandRunner: AwsCommandRunner,
  request: AcquireBlitzGameStackAdmissionRequest,
): void {
  assertMainnetBlitzControlRequest(request);
  assertAdmissionMatchesQuote(request);

  const now = request.now ?? new Date();
  const nowEpochSeconds = toEpochSeconds(now);
  runConditionalBlitzTransaction(
    commandRunner,
    "acquire Blitz game-stack admission",
    [
      "dynamodb",
      "transact-write-items",
      "--region",
      request.region,
      "--transact-items",
      JSON.stringify(buildAdmissionTransaction(request, now, nowEpochSeconds)),
    ],
    new GameStackStoreConflictError(
      "Blitz launch admission was rejected because its challenge, quote, or playable slot is no longer valid",
    ),
  );
}

export function releaseBlitzGameStackAdmission(
  commandRunner: AwsCommandRunner,
  request: ReleaseBlitzGameStackAdmissionRequest,
): void {
  assertMainnetBlitzControlRequest(request);
  runRequiredAwsCommand(
    commandRunner,
    `release Blitz admission for "${request.gameStackId}"`,
    buildReleaseAdmissionCommand(request, request.gameStackId),
  );
}

export function persistBlitzGameStackTransition(
  commandRunner: AwsCommandRunner,
  request: PersistBlitzGameStackTransitionRequest,
): void {
  assertMainnetBlitzControlRequest(request);
  assertTransitionIdentityIsImmutable(request);
  runConditionalBlitzTransaction(
    commandRunner,
    `persist Blitz game-stack transition for "${request.next.gameStackId}"`,
    buildPersistTransitionCommand(request),
    new GameStackStoreConflictError(
      `Blitz game stack "${request.next.gameStackId}" changed before its lifecycle transition could be persisted`,
    ),
  );
}

export async function closeExpiredBlitzGameStack(
  commandRunner: AwsCommandRunner,
  request: CloseExpiredBlitzGameStackRequest,
  removeActiveAlias: (identity: ExpiredBlitzGameStackPublicationIdentity) => Promise<boolean>,
): Promise<CloseExpiredBlitzGameStackResult> {
  assertMainnetBlitzControlRequest(request);
  const now = request.now ?? new Date();
  assertGameStackWindowHasEnded(request.activeUntil, now);

  const aliasRemoved = await removeActiveAlias(buildExpiredGameStackPublicationIdentity(request));
  const admissionReleased = aliasRemoved ? releaseExpiredBlitzAdmission(commandRunner, request, now) : false;
  return {
    gameStackId: request.gameStackId,
    activeUntil: request.activeUntil,
    aliasRemoved,
    admissionReleased,
  };
}

function buildExpiredGameStackPublicationIdentity(
  request: CloseExpiredBlitzGameStackRequest,
): ExpiredBlitzGameStackPublicationIdentity {
  return {
    gameStackId: request.gameStackId,
    activeUntil: request.activeUntil,
    publicationRevision: request.publicationRevision,
  };
}

function assertGameStackWindowHasEnded(activeUntil: string, now: Date): void {
  const activeUntilTimestamp = Date.parse(activeUntil);
  if (!Number.isFinite(activeUntilTimestamp) || activeUntilTimestamp > now.getTime()) {
    throw new Error("Blitz game-stack closure requires a valid elapsed activeUntil");
  }
}

function releaseExpiredBlitzAdmission(
  commandRunner: AwsCommandRunner,
  request: CloseExpiredBlitzGameStackRequest,
  now: Date,
): boolean {
  const result = commandRunner(buildReleaseExpiredAdmissionCommand(request, now));
  if ((result.status ?? 1) === 0) return true;
  const output = buildAwsCommandOutput(result);
  if (/ConditionalCheckFailed|ResourceNotFound/i.test(output)) return false;
  throw new Error(`Failed to release expired Blitz admission: ${output || "aws command failed"}`);
}

function buildReleaseExpiredAdmissionCommand(request: CloseExpiredBlitzGameStackRequest, now: Date): string[] {
  return [
    "dynamodb",
    "delete-item",
    "--region",
    request.region,
    "--table-name",
    request.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildAdmissionKey(request.environmentId) } }),
    "--condition-expression",
    "GameStackId = :gameStackId AND ActiveUntilEpochSeconds <= :now",
    "--expression-attribute-values",
    JSON.stringify({
      ":gameStackId": { S: request.gameStackId },
      ":now": { N: `${toEpochSeconds(now)}` },
    }),
  ];
}

function buildReleaseAdmissionCommand(request: BlitzControlRequest, gameStackId: string): string[] {
  return [
    "dynamodb",
    "delete-item",
    "--region",
    request.region,
    "--table-name",
    request.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildAdmissionKey(request.environmentId) } }),
    "--condition-expression",
    "GameStackId = :gameStackId",
    "--expression-attribute-values",
    JSON.stringify({ ":gameStackId": { S: gameStackId } }),
  ];
}

function buildPersistTransitionCommand(request: PersistBlitzGameStackTransitionRequest): string[] {
  return [
    "dynamodb",
    "update-item",
    "--region",
    request.region,
    "--table-name",
    request.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildGameStackKey(request.next.gameStackId) } }),
    "--update-expression",
    "SET ProtocolLifecycle = :protocolLifecycle, OperationalPhase = :operationalPhase, GameStackJson = :gameStackJson",
    "--condition-expression",
    "GameStackId = :gameStackId AND GameStackJson = :expectedGameStackJson",
    "--expression-attribute-values",
    JSON.stringify({
      ":gameStackId": { S: request.next.gameStackId },
      ":expectedGameStackJson": { S: JSON.stringify(request.expected) },
      ":protocolLifecycle": { S: request.next.protocolLifecycle },
      ":operationalPhase": { S: request.next.operationalPhase },
      ":gameStackJson": { S: JSON.stringify(request.next) },
    }),
  ];
}

function assertTransitionIdentityIsImmutable(request: PersistBlitzGameStackTransitionRequest): void {
  if (
    request.expected.gameStackId !== request.next.gameStackId ||
    request.expected.deploymentId !== request.next.deploymentId
  ) {
    throw new Error("Blitz game-stack transition cannot change immutable stack or deployment identity");
  }
}

export function failBlitzGameStackProvisioning(
  commandRunner: AwsCommandRunner,
  request: FailBlitzGameStackProvisioningRequest,
): void {
  assertMainnetBlitzControlRequest(request);
  if (request.gameStack.operationalPhase !== "failed" || !request.gameStack.failure) {
    throw new Error("Failed Blitz game-stack persistence requires structured failure data");
  }

  persistBlitzGameStackProvisioningFailure(commandRunner, request);
  releaseFailedGameStackAdmission(commandRunner, request);
}

export function persistBlitzGameStackProvisioningFailure(
  commandRunner: AwsCommandRunner,
  request: FailBlitzGameStackProvisioningRequest,
): void {
  assertMainnetBlitzControlRequest(request);
  if (request.gameStack.operationalPhase !== "failed" || !request.gameStack.failure) {
    throw new Error("Failed Blitz game-stack persistence requires structured failure data");
  }
  runRequiredAwsCommand(commandRunner, `persist failed Blitz game stack "${request.gameStack.gameStackId}"`, [
    "dynamodb",
    "update-item",
    "--region",
    request.region,
    "--table-name",
    request.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildGameStackKey(request.gameStack.gameStackId) } }),
    "--update-expression",
    "SET ProtocolLifecycle = :protocolLifecycle, OperationalPhase = :operationalPhase, FailureJson = :failureJson, GameStackJson = :gameStackJson",
    "--condition-expression",
    "GameStackId = :gameStackId",
    "--expression-attribute-values",
    JSON.stringify({
      ":gameStackId": { S: request.gameStack.gameStackId },
      ":protocolLifecycle": { S: request.gameStack.protocolLifecycle },
      ":operationalPhase": { S: request.gameStack.operationalPhase },
      ":failureJson": { S: JSON.stringify(request.gameStack.failure) },
      ":gameStackJson": { S: JSON.stringify(request.gameStack) },
    }),
  ]);
}

function releaseFailedGameStackAdmission(
  commandRunner: AwsCommandRunner,
  request: FailBlitzGameStackProvisioningRequest,
): void {
  const result = commandRunner(buildReleaseAdmissionCommand(request, request.gameStack.gameStackId));
  if ((result.status ?? 1) === 0) return;
  const output = buildAwsCommandOutput(result);
  if (/ConditionalCheckFailed/i.test(output)) return;
  throw new Error(`Failed to release failed Blitz admission: ${output || "aws command failed"}`);
}

export function readActiveBlitzGameStack(
  commandRunner: AwsCommandRunner,
  request: ReadActiveBlitzGameStackRequest,
): ActiveBlitzGameStackAdmission | undefined {
  assertMainnetBlitzControlRequest(request);
  const result = runRequiredAwsCommand(commandRunner, "read active Blitz admission", [
    "dynamodb",
    "get-item",
    "--region",
    request.region,
    "--table-name",
    request.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: buildAdmissionKey(request.environmentId) } }),
    "--consistent-read",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{
    Item?: { GameStackId?: { S?: string }; ActiveUntil?: { S?: string }; ActiveUntilEpochSeconds?: { N?: string } };
  }>(result.stdout || "", {});
  const gameStackId = payload.Item?.GameStackId?.S;
  const activeUntilEpochSeconds = Number(payload.Item?.ActiveUntilEpochSeconds?.N);
  if (!gameStackId || !Number.isInteger(activeUntilEpochSeconds)) {
    return undefined;
  }
  if (activeUntilEpochSeconds <= toEpochSeconds(request.now ?? new Date())) {
    return undefined;
  }

  return {
    gameStackId,
    activeUntil: payload.Item?.ActiveUntil?.S || new Date(activeUntilEpochSeconds * 1_000).toISOString(),
  };
}

function saveAuthenticationChallenge(
  commandRunner: AwsCommandRunner,
  config: AwsCliGameStackApiStoreConfig,
  challenge: BlitzAuthChallenge,
): void {
  const expiresAtEpochSeconds = toEpochSeconds(new Date(challenge.expiresAt));
  runRequiredAwsCommand(commandRunner, `save Blitz authentication challenge "${challenge.challengeId}"`, [
    "dynamodb",
    "put-item",
    "--region",
    config.region,
    "--table-name",
    config.tableName,
    "--item",
    JSON.stringify({
      ControlKey: { S: buildChallengeKey(challenge.challengeId) },
      RecordType: { S: "blitz-auth-challenge" },
      RequesterWallet: { S: challenge.requesterWallet },
      Action: { S: challenge.action },
      MessageHash: { S: challenge.messageHash },
      ChallengeJson: { S: JSON.stringify(challenge) },
      ExpiresAtEpochSeconds: { N: `${expiresAtEpochSeconds}` },
      ExpiresAt: { N: `${expiresAtEpochSeconds}` },
    }),
    "--condition-expression",
    "attribute_not_exists(ControlKey)",
  ]);
}

function consumeChallengeAndSaveQuote(
  commandRunner: AwsCommandRunner,
  config: AwsCliGameStackApiStoreConfig,
  challengeId: string,
  quote: BlitzLaunchQuote,
): void {
  const now = readStoreClock(config);
  const nowEpochSeconds = toEpochSeconds(now);
  const expiresAtEpochSeconds = toEpochSeconds(new Date(quote.expiresAt));
  runConditionalBlitzTransaction(
    commandRunner,
    `consume Blitz challenge and save quote "${quote.quoteId}"`,
    [
      "dynamodb",
      "transact-write-items",
      "--region",
      config.region,
      "--transact-items",
      JSON.stringify([
        buildConsumeChallengeUpdate(
          config.tableName,
          challengeId,
          quote.requesterWallet,
          "create-launch-quote",
          now,
          nowEpochSeconds,
        ),
        {
          Put: {
            TableName: config.tableName,
            Item: {
              ControlKey: { S: buildQuoteKey(quote.quoteId) },
              RecordType: { S: "blitz-launch-quote" },
              RequesterWallet: { S: quote.requesterWallet },
              QuoteJson: { S: JSON.stringify(quote) },
              ExpiresAtEpochSeconds: { N: `${expiresAtEpochSeconds}` },
              ExpiresAt: { N: `${expiresAtEpochSeconds}` },
            },
            ConditionExpression: "attribute_not_exists(ControlKey)",
          },
        },
      ]),
    ],
    new GameStackStoreConflictError("Blitz authentication challenge was already consumed or expired"),
  );
}

function readControlRecord<T>(
  commandRunner: AwsCommandRunner,
  config: AwsCliGameStackApiStoreConfig,
  controlKey: string,
  jsonAttribute: string,
): T | undefined {
  const result = runRequiredAwsCommand(commandRunner, `read Blitz control record "${controlKey}"`, [
    "dynamodb",
    "get-item",
    "--region",
    config.region,
    "--table-name",
    config.tableName,
    "--key",
    JSON.stringify({ ControlKey: { S: controlKey } }),
    "--consistent-read",
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ Item?: Record<string, { S?: string }> }>(result.stdout || "", {});
  const serializedRecord = payload.Item?.[jsonAttribute]?.S;
  return serializedRecord ? (JSON.parse(serializedRecord) as T) : undefined;
}

function buildConsumeChallengeUpdate(
  tableName: string,
  challengeId: string,
  requesterWallet: string,
  action: BlitzAuthChallenge["action"],
  consumedAt: Date,
  nowEpochSeconds: number,
): unknown {
  return {
    Update: {
      TableName: tableName,
      Key: { ControlKey: { S: buildChallengeKey(challengeId) } },
      UpdateExpression: "SET ConsumedAt = :consumedAt",
      ConditionExpression:
        "attribute_not_exists(ConsumedAt) AND ExpiresAtEpochSeconds > :now AND RequesterWallet = :requesterWallet AND #action = :action",
      ExpressionAttributeNames: { "#action": "Action" },
      ExpressionAttributeValues: {
        ":action": { S: action },
        ":consumedAt": { S: consumedAt.toISOString() },
        ":now": { N: `${nowEpochSeconds}` },
        ":requesterWallet": { S: requesterWallet },
      },
    },
  };
}

function buildAdmissionTransaction(
  request: AcquireBlitzGameStackAdmissionRequest,
  now: Date,
  nowEpochSeconds: number,
): unknown[] {
  const consumedAt = now.toISOString();
  const activeUntilEpochSeconds = toEpochSeconds(new Date(request.gameStack.intendedEnd));
  const expiresAt = activeUntilEpochSeconds + GAME_STACK_RETENTION_SECONDS;

  return [
    buildConsumeChallengeUpdate(
      request.tableName,
      request.challengeId,
      request.gameStack.requesterWallet,
      "create-game-stack",
      now,
      nowEpochSeconds,
    ),
    {
      Update: {
        TableName: request.tableName,
        Key: { ControlKey: { S: buildQuoteKey(request.quoteId) } },
        UpdateExpression: "SET ConsumedAt = :consumedAt, GameStackId = :gameStackId",
        ConditionExpression:
          "attribute_not_exists(ConsumedAt) AND ExpiresAtEpochSeconds > :now AND RequesterWallet = :requesterWallet",
        ExpressionAttributeValues: {
          ":consumedAt": { S: consumedAt },
          ":gameStackId": { S: request.gameStack.gameStackId },
          ":now": { N: `${nowEpochSeconds}` },
          ":requesterWallet": { S: request.gameStack.requesterWallet },
        },
      },
    },
    {
      Put: {
        TableName: request.tableName,
        Item: {
          ControlKey: { S: buildAdmissionKey(request.environmentId) },
          RecordType: { S: "blitz-admission" },
          EnvironmentId: { S: request.environmentId },
          GameStackId: { S: request.gameStack.gameStackId },
          RequesterWallet: { S: request.gameStack.requesterWallet },
          IntendedStart: { S: request.gameStack.intendedStart },
          ActiveUntil: { S: request.gameStack.intendedEnd },
          ActiveUntilEpochSeconds: { N: `${activeUntilEpochSeconds}` },
          ExpiresAt: { N: `${expiresAt}` },
        },
        ConditionExpression: "attribute_not_exists(ControlKey) OR ActiveUntilEpochSeconds <= :now",
        ExpressionAttributeValues: { ":now": { N: `${nowEpochSeconds}` } },
      },
    },
    {
      Put: {
        TableName: request.tableName,
        Item: {
          ControlKey: { S: buildGameStackKey(request.gameStack.gameStackId) },
          RecordType: { S: "game-stack" },
          EnvironmentId: { S: request.environmentId },
          GameStackId: { S: request.gameStack.gameStackId },
          DeploymentId: { S: request.gameStack.deploymentId },
          RequesterWallet: { S: request.gameStack.requesterWallet },
          ProtocolLifecycle: { S: request.gameStack.protocolLifecycle },
          OperationalPhase: { S: request.gameStack.operationalPhase },
          GameStackJson: { S: JSON.stringify(request.gameStack) },
          ExpiresAt: { N: `${expiresAt}` },
        },
        ConditionExpression: "attribute_not_exists(ControlKey)",
      },
    },
  ];
}

function assertMainnetBlitzControlRequest(request: BlitzControlRequest): void {
  if (request.environmentId !== BLITZ_ENVIRONMENT_ID) {
    throw new Error(`Blitz public admission is only supported for ${BLITZ_ENVIRONMENT_ID}`);
  }
  if (!request.tableName.trim()) {
    throw new Error("Blitz public admission requires the AWS runtime control table");
  }
}

function assertAdmissionMatchesQuote(request: AcquireBlitzGameStackAdmissionRequest): void {
  if (request.quoteId !== request.gameStack.quoteId) {
    throw new Error("Blitz admission quote does not match the game stack");
  }
  const start = Date.parse(request.gameStack.intendedStart);
  const end = Date.parse(request.gameStack.intendedEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Blitz admission requires a valid configured gameplay window");
  }
}

function buildChallengeKey(challengeId: string): string {
  return `AUTH#${challengeId}`;
}

function buildQuoteKey(quoteId: string): string {
  return `QUOTE#${quoteId}`;
}

function buildAdmissionKey(environmentId: string): string {
  return `ADMISSION#${environmentId}`;
}

function buildGameStackKey(gameStackId: string): string {
  return `GAME_STACK#${gameStackId}`;
}

function toEpochSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1_000);
}

function readStoreClock(config: AwsCliGameStackApiStoreConfig): Date {
  return config.now?.() ?? new Date();
}

function runConditionalBlitzTransaction(
  commandRunner: AwsCommandRunner,
  action: string,
  args: string[],
  conflictError: GameStackStoreConflictError,
): void {
  const result = commandRunner(args);
  if ((result.status ?? 1) === 0) return;

  const output = buildAwsCommandOutput(result);
  if (/TransactionCanceledException|ConditionalCheckFailed/i.test(output)) {
    throw conflictError;
  }
  throw new Error(`Failed to ${action}: ${output || "aws command failed"}`);
}
