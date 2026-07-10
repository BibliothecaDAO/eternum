import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";

const temporaryDirectories: string[] = [];
const sourceFileSystemId = "fs-12345678";
const destinationFileSystemId = "fs-87654321";
const destinationFileSystemArn = `arn:aws:elasticfilesystem:us-west-2:222222222222:file-system/${destinationFileSystemId}`;
const replicationRoleArn = "arn:aws:iam::111111111111:role/runtime-efs-replication";

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("AWS runtime DR automation", () => {
  test("rejects replication state outside the regional RPO", () => {
    const fixture = createFakeAwsFixture("stale");
    const result = runDrScript(fixture, "status");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      operation: "aws-runtime-dr",
      status: "failed",
      errorMessage: expect.stringContaining("exceeds the 1200s regional RPO"),
    });
  });

  test("waits for replication removal before reporting a promoted replica", () => {
    const fixture = createFakeAwsFixture("healthy");
    const result = runDrScript(fixture, "promote");

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      operation: "promote",
      status: "passed",
      destinationStatus: "ENABLED",
      promotedAt: expect.any(String),
    });
    const commands = readAwsCommands(fixture.commandLogPath);
    expect(
      commands.filter((args) => args.slice(0, 2).join(" ") === "efs describe-replication-configurations"),
    ).toHaveLength(2);
    expect(commands.some((args) => args.slice(0, 2).join(" ") === "efs delete-replication-configuration")).toBe(true);
  });

  test("waits for Route53 INSYNC before completing failover", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const result = runRecoveryScript(fixture, manifestPath, "route53");

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).route53Result).toMatchObject({
      ChangeInfo: { Id: "/change/C123" },
      insyncAt: expect.any(String),
    });
    expect(readAwsCommands(fixture.commandLogPath).map((args) => args.slice(0, 3).join(" "))).toEqual([
      "route53 change-resource-record-sets --hosted-zone-id",
      "route53 wait resource-record-sets-changed",
    ]);
  });

  test("rejects Route53 batches that omit the recovered shard host", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.route53ChangeBatch.Changes = [];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = runRecoveryScript(fixture, manifestPath, "route53");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).errorMessage).toContain("at least one alias UPSERT");
    expect(readAwsCommands(fixture.commandLogPath)).toEqual([]);
  });

  test("rejects Route53 aliases that do not target the DR foundation ALB", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.route53ChangeBatch.Changes[0].ResourceRecordSet.AliasTarget.DNSName =
      "unapproved.us-west-2.elb.amazonaws.com";
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = runRecoveryScript(fixture, manifestPath, "route53");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).errorMessage).toContain("invalid change");
    expect(readAwsCommands(fixture.commandLogPath)).toEqual([]);
  });

  test("preflights every registry-selected digest in destination ECR", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());

    const result = runRecoveryScript(fixture, manifestPath, "preflight");

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).imagePreflight).toMatchObject({
      repositoryUrl: "222222222222.dkr.ecr.us-west-2.amazonaws.com/eternum-mainnet-blitz-runtime",
      imageDigests: [`sha256:${"a".repeat(64)}`],
      checkedAt: expect.any(String),
    });
    expect(readAwsCommands(fixture.commandLogPath).map((args) => args.slice(0, 2).join(" "))).toEqual([
      "ecr describe-images",
    ]);
  });

  test("rejects registry route hosts outside the configured runtime domain", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());

    const result = runRecoveryScript(fixture, manifestPath, "preflight", {
      RUNTIME_REGISTRY_URL: buildFakeRuntimeRegistryUrl("s0.mainnet-blitz.attacker.example"),
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).errorMessage).toContain("invalid route host");
    expect(readAwsCommands(fixture.commandLogPath)).toEqual([]);
  });

  test("validates recovered target and semantic health before failover", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.runtimes = [
      {
        environmentId: "mainnet.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-recovery",
        runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
        imageDigest: `sha256:${"a".repeat(64)}`,
        worldAddress: "0x123",
      },
    ];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = runRecoveryScript(fixture, manifestPath, "deploy");

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).runtimeResults[0].recoveryHealth).toMatchObject({
      targetGroupArn: "arn:aws:elasticloadbalancing:us-west-2:222222222222:targetgroup/runtime/123",
      taskArn: "arn:aws:ecs:us-west-2:222222222222:task/runtime/task-123",
      checkedAt: expect.any(String),
    });
    expect(readAwsCommands(fixture.commandLogPath).map((args) => args.slice(0, 3).join(" "))).toEqual([
      "elbv2 wait target-in-service",
      "ecs list-tasks --region",
      "ecs execute-command --region",
    ]);
  });

  test("rejects a recovery manifest whose immutable runtime is absent from the registry", () => {
    const fixture = createFakeAwsFixture("healthy");
    const manifestPath = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.runtimes = [
      {
        environmentId: "mainnet.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-recovery",
        runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-000000000099",
      },
    ];
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const result = runRecoveryScript(fixture, manifestPath, "deploy");

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout).errorMessage).toContain("is not in the registry");
    expect(readAwsCommands(fixture.commandLogPath)).toEqual([]);
  });

  test("enforces regional RTO after recovery and registry activation", () => {
    const fixture = createFakeAwsFixture("healthy");
    const currentManifest = writeRecoveryManifest(fixture.directory, new Date().toISOString());
    const currentResult = runRecoveryScript(fixture, currentManifest, "measure");

    expect(currentResult.status).toBe(0);
    expect(JSON.parse(currentResult.stdout)).toMatchObject({
      recoveryOperation: "measure",
      status: "passed",
      rtoSeconds: expect.any(Number),
    });

    const staleManifest = writeRecoveryManifest(
      fixture.directory,
      new Date(Date.now() - 2 * 60 * 60 * 1000 - 1_000).toISOString(),
      "stale-manifest.json",
    );
    const staleResult = runRecoveryScript(fixture, staleManifest, "measure");
    expect(staleResult.status).toBe(1);
    expect(JSON.parse(staleResult.stdout).errorMessage).toContain("exceeds 7200s");
  });
});

interface FakeAwsFixture {
  directory: string;
  commandLogPath: string;
  statePath: string;
  mode: "healthy" | "stale";
}

function createFakeAwsFixture(mode: FakeAwsFixture["mode"]): FakeAwsFixture {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-dr-"));
  temporaryDirectories.push(directory);
  const commandLogPath = path.join(directory, "commands.jsonl");
  const statePath = path.join(directory, "state.json");
  fs.writeFileSync(statePath, JSON.stringify({ deleted: false }));
  writeFakeAwsCli(directory);
  writeFakeBunCli(directory);
  return { directory, commandLogPath, statePath, mode };
}

function runDrScript(fixture: FakeAwsFixture, operation: string) {
  return spawnSync("node", ["scripts/aws-runtime-dr.mjs", "--operation", operation], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: buildFakeAwsEnvironment(fixture),
  });
}

function runRecoveryScript(
  fixture: FakeAwsFixture,
  manifestPath: string,
  operation: string,
  environmentOverrides: NodeJS.ProcessEnv = {},
) {
  return spawnSync(
    "node",
    ["scripts/recover-aws-runtime-from-registry.mjs", "--manifest-file", manifestPath, "--operation", operation],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...buildFakeAwsEnvironment(fixture), ...environmentOverrides },
    },
  );
}

function buildFakeAwsEnvironment(fixture: FakeAwsFixture): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${fixture.directory}:${process.env.PATH}`,
    AWS_RUNTIME_EFS_FILE_SYSTEM_ID: sourceFileSystemId,
    AWS_RUNTIME_DR_EFS_FILE_SYSTEM_ARN: destinationFileSystemArn,
    AWS_RUNTIME_EFS_REPLICATION_ROLE_ARN: replicationRoleArn,
    AWS_RUNTIME_CLUSTER: "eternum-dr-runtime",
    AWS_REGION: "us-west-2",
    AWS_RUNTIME_DR_PROMOTION_POLL_SECONDS: "1",
    AWS_RUNTIME_ECR_REPOSITORY_URL: "222222222222.dkr.ecr.us-west-2.amazonaws.com/eternum-mainnet-blitz-runtime",
    AWS_DR_RUNTIME_ALB_DNS_NAMES: JSON.stringify(["eternum-dr-123.us-west-2.elb.amazonaws.com"]),
    AWS_DR_RUNTIME_ALB_HOSTED_ZONE_IDS: JSON.stringify(["ZDR123"]),
    FAKE_AWS_COMMAND_LOG: fixture.commandLogPath,
    FAKE_AWS_STATE_FILE: fixture.statePath,
    FAKE_AWS_MODE: fixture.mode,
    FAKE_AWS_DESTINATION_FILE_SYSTEM_ID: destinationFileSystemId,
    FAKE_AWS_REPLICATION_ROLE_ARN: replicationRoleArn,
    RUNTIME_REGISTRY_URL: buildFakeRuntimeRegistryUrl(),
  };
}

function buildFakeRuntimeRegistryUrl(awsHost = "s0.mainnet-blitz.runtime.realms.world"): string {
  const runtimeInstanceId = "018f6e54-5f4a-7ae2-a0ff-123456789abc";
  const prefix = "game.mainnet.blitz.bltz-recovery.torii";
  const aliases = Object.fromEntries(
    ["base", "health", "sql"].map((endpointKind) => [
      `${prefix}.${endpointKind}`,
      {
        scope: "game",
        environmentId: "mainnet.blitz",
        runtimeKind: "torii",
        endpointKind,
        activeProvider: "aws",
        runtimeName: "bltz-recovery",
        providers: {
          slot: `https://api.cartridge.gg/x/bltz-recovery/torii${endpointKind === "base" ? "" : `/${endpointKind}`}`,
          aws: `https://${awsHost}/x/mainnet-blitz/bltz-recovery/torii${endpointKind === "base" ? "" : `/${endpointKind}`}`,
        },
        runtimeInstanceId,
        imageDigest: `sha256:${"a".repeat(64)}`,
        routingShard: 0,
      },
    ]),
  );
  return `data:application/json,${encodeURIComponent(
    JSON.stringify({
      schemaVersion: "realms-runtime-registry/v1",
      revision: 1,
      generatedAt: "2026-07-10T00:00:00.000Z",
      aliases,
    }),
  )}`;
}

function writeRecoveryManifest(directory: string, recoveryStartedAt: string, name = "manifest.json"): string {
  const manifestPath = path.join(directory, name);
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({
      schemaVersion: 1,
      environmentId: "mainnet.blitz",
      recoveryStartedAt,
      hostedZoneId: "Z123",
      route53ChangeBatch: {
        Changes: [
          {
            Action: "UPSERT",
            ResourceRecordSet: {
              Name: "s0.mainnet-blitz.runtime.realms.world",
              Type: "A",
              AliasTarget: {
                DNSName: "dualstack.eternum-dr-123.us-west-2.elb.amazonaws.com",
                HostedZoneId: "ZDR123",
                EvaluateTargetHealth: true,
              },
            },
          },
        ],
      },
      registryAliasPrefixes: ["game.mainnet.blitz.bltz-recovery.torii."],
      runtimes: [
        {
          environmentId: "mainnet.blitz",
          runtimeKind: "torii",
          runtimeName: "bltz-recovery",
          runtimeInstanceId: "018f6e54-5f4a-7ae2-a0ff-123456789abc",
        },
      ],
    }),
  );
  return manifestPath;
}

function readAwsCommands(commandLogPath: string): string[][] {
  if (!fs.existsSync(commandLogPath)) {
    return [];
  }
  return fs
    .readFileSync(commandLogPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

function writeFakeAwsCli(directory: string): void {
  const scriptPath = path.join(directory, "aws");
  fs.writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_AWS_COMMAND_LOG, JSON.stringify(args) + "\\n");
const state = JSON.parse(fs.readFileSync(process.env.FAKE_AWS_STATE_FILE, "utf8"));

if (args[0] === "efs" && args[1] === "describe-replication-configurations") {
  if (state.deleted) {
    process.stdout.write(JSON.stringify({ Replications: [] }));
    process.exit(0);
  }
  const lagMs = process.env.FAKE_AWS_MODE === "stale" ? 21 * 60 * 1000 : 30 * 1000;
  process.stdout.write(JSON.stringify({
    Replications: [{
      Destinations: [{
        FileSystemId: process.env.FAKE_AWS_DESTINATION_FILE_SYSTEM_ID,
        Region: "us-west-2",
        RoleArn: process.env.FAKE_AWS_REPLICATION_ROLE_ARN,
        Status: "ENABLED",
        LastReplicatedTimestamp: new Date(Date.now() - lagMs).toISOString()
      }]
    }]
  }));
  process.exit(0);
}

if (args[0] === "efs" && args[1] === "delete-replication-configuration") {
  fs.writeFileSync(process.env.FAKE_AWS_STATE_FILE, JSON.stringify({ deleted: true }));
  process.exit(0);
}

if (args[0] === "ecr" && args[1] === "describe-images") {
  const imageId = args[args.indexOf("--image-ids") + 1];
  process.stdout.write(JSON.stringify({ imageDetails: [{ imageDigest: imageId.replace("imageDigest=", "") }] }));
  process.exit(0);
}

if (args[0] === "route53" && args[1] === "change-resource-record-sets") {
  process.stdout.write(JSON.stringify({ ChangeInfo: { Id: "/change/C123", Status: "PENDING" } }));
  process.exit(0);
}

if (args[0] === "route53" && args[1] === "wait" && args[2] === "resource-record-sets-changed") {
  process.exit(0);
}

if (args[0] === "elbv2" && args[1] === "wait" && args[2] === "target-in-service") {
  process.exit(0);
}

if (args[0] === "ecs" && args[1] === "list-tasks") {
  process.stdout.write(JSON.stringify({ taskArns: ["arn:aws:ecs:us-west-2:222222222222:task/runtime/task-123"] }));
  process.exit(0);
}

if (args[0] === "ecs" && args[1] === "execute-command") {
  process.stdout.write("recovery-health-ok");
  process.exit(0);
}

process.stderr.write("Unexpected fake AWS command: " + args.join(" "));
process.exit(1);
`,
  );
  fs.chmodSync(scriptPath, 0o755);
}

function writeFakeBunCli(directory: string): void {
  const scriptPath = path.join(directory, "bun");
  fs.writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  operation: "deploy",
  liveState: {
    serviceName: "mainnet-blitz-torii-bltz-recovery-1234567890abcdef",
    targetGroupArn: "arn:aws:elasticloadbalancing:us-west-2:222222222222:targetgroup/runtime/123"
  }
}));
`,
  );
  fs.chmodSync(scriptPath, 0o755);
}
