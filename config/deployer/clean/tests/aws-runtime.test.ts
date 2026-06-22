import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  buildAwsRuntimeEndpointUrl,
  buildAwsRuntimeServiceName,
  classifyAwsRuntimeFailure,
  createAwsRuntimeCommandBackend,
  resolveAwsRuntimeTier,
  resolveAwsRuntimeEndpoint,
  toAwsRuntimeArtifact,
} from "../runtime/aws-runtime";

const AWS_ENV_KEYS = [
  "AWS_REGION",
  "AWS_RUNTIME_CLUSTER",
  "AWS_RUNTIME_ECR_IMAGE",
  "AWS_RUNTIME_ECR_IMAGE_DIGEST",
  "AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN",
  "AWS_RUNTIME_TASK_ROLE_ARN",
  "AWS_RUNTIME_SUBNET_IDS",
  "AWS_RUNTIME_SECURITY_GROUP_IDS",
  "AWS_RUNTIME_EFS_FILE_SYSTEM_ID",
  "AWS_RUNTIME_VPC_ID",
  "AWS_RUNTIME_ALB_LISTENER_ARN",
] as const;

const originalEnv = new Map<string, string | undefined>(AWS_ENV_KEYS.map((key) => [key, process.env[key]]));

function restoreAwsEnv(): void {
  for (const key of AWS_ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function configureAwsRuntimeEnv(): void {
  process.env.AWS_REGION = "us-east-1";
  process.env.AWS_RUNTIME_CLUSTER = "eternum-game-runtime";
  process.env.AWS_RUNTIME_ECR_IMAGE = "123456789012.dkr.ecr.us-east-1.amazonaws.com/eternum-runtime@sha256:abc";
  process.env.AWS_RUNTIME_ECR_IMAGE_DIGEST = "sha256:abc";
  process.env.AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN = "arn:aws:iam::123456789012:role/runtime-execution";
  process.env.AWS_RUNTIME_TASK_ROLE_ARN = "arn:aws:iam::123456789012:role/runtime-task";
  process.env.AWS_RUNTIME_SUBNET_IDS = "subnet-a,subnet-b";
  process.env.AWS_RUNTIME_SECURITY_GROUP_IDS = "sg-runtime";
  process.env.AWS_RUNTIME_EFS_FILE_SYSTEM_ID = "fs-123";
  process.env.AWS_RUNTIME_VPC_ID = "vpc-123";
  process.env.AWS_RUNTIME_ALB_LISTENER_ARN = "arn:aws:elasticloadbalancing:listener/app/runtime/123/456";
}

function okAwsCommand(stdout = "") {
  return {
    status: 0,
    stdout,
    stderr: "",
    signal: null,
    output: ["", stdout, ""],
    pid: 123,
  } as never;
}

function activeRuntimeServicePayload() {
  return JSON.stringify({
    services: [
      {
        status: "ACTIVE",
        clusterArn: "arn:aws:ecs:cluster/runtime",
        serviceArn: "arn:aws:ecs:service/runtime/bltz-fire-gate-42",
        taskDefinition: "arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1",
        loadBalancers: [
          {
            targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
          },
        ],
        tags: [
          { key: "RuntimeTier", value: "basic" },
          { key: "RuntimeVersion", value: "v1.8.16" },
          { key: "EfsAccessPointId", value: "fsap-123" },
          { key: "TargetGroupArn", value: "arn:aws:elasticloadbalancing:targetgroup/runtime/123" },
        ],
      },
    ],
  });
}

function findCommand(commands: string[][], commandName: string): string[] {
  const command = commands.find((args) => args.slice(0, 2).join(" ") === commandName);
  expect(command).toBeDefined();
  return command!;
}

function readJsonArg<T>(command: string[], flag: string): T {
  const value = command[command.indexOf(flag) + 1];
  expect(value).toBeDefined();
  return JSON.parse(value!) as T;
}

function readLoggedAwsCommands(logPath: string): string[][] {
  return fs
    .readFileSync(logPath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as string[]);
}

function writeFakeAwsCli(tempDir: string): string {
  const scriptPath = path.join(tempDir, "aws");
  fs.writeFileSync(
    scriptPath,
    `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.AWS_COMMAND_LOG, JSON.stringify(args) + "\\n");

const statePath = process.env.AWS_STATE_FILE;
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { describes: 0 };
function saveState() {
  fs.writeFileSync(statePath, JSON.stringify(state));
}
function write(value) {
  process.stdout.write(value);
}

if (args[0] === "ecs" && args[1] === "describe-services") {
  state.describes += 1;
  saveState();
  if (state.describes === 1) {
    write(JSON.stringify({ services: [] }));
  } else {
    write(${JSON.stringify(activeRuntimeServicePayload())});
  }
  process.exit(0);
}

if (args[0] === "efs" && args[1] === "create-access-point") {
  write("fsap-123\\n");
  process.exit(0);
}

if (args[0] === "ecs" && args[1] === "register-task-definition") {
  write("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\\n");
  process.exit(0);
}

if (args[0] === "elbv2" && args[1] === "create-target-group") {
  write("arn:aws:elasticloadbalancing:targetgroup/runtime/123\\n");
  process.exit(0);
}

process.exit(0);
`,
  );
  fs.chmodSync(scriptPath, 0o755);
  return scriptPath;
}

afterEach(() => {
  restoreAwsEnv();
});

describe("AWS runtime helpers", () => {
  test("builds public single-domain runtime endpoints", () => {
    expect(
      buildAwsRuntimeEndpointUrl({
        domain: "runtime.realms.world",
        runtimeName: "bltz-fire-gate-42",
        runtimeKind: "torii",
        endpointKind: "sql",
      }),
    ).toBe("https://runtime.realms.world/x/bltz-fire-gate-42/torii/sql");

    expect(
      buildAwsRuntimeEndpointUrl({
        domain: "runtime.realms.world",
        runtimeName: "eternum-slot",
        runtimeKind: "katana",
        endpointKind: "rpc",
      }),
    ).toBe("https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9");

    expect(
      resolveAwsRuntimeEndpoint({
        domain: "runtime.realms.world",
        runtimeId: "bltz-fire-gate-42",
        runtimeKind: "torii",
        endpointKind: "wss",
      }),
    ).toBe("https://runtime.realms.world/x/bltz-fire-gate-42/torii/wss");
  });

  test("normalizes AWS service names for runtime isolation", () => {
    expect(
      buildAwsRuntimeServiceName({ environmentId: "slot.blitz", runtimeKind: "torii", runtimeName: "Bltz_01" }),
    ).toBe("slot-blitz-torii-bltz-01");
  });

  test("maps fixed runtime tiers to conservative Fargate sizing", () => {
    expect(resolveAwsRuntimeTier("basic")).toEqual({
      cpu: 1024,
      memory: 2048,
      desiredCount: 1,
      efsProvisionedThroughputMibps: 8,
    });

    expect(resolveAwsRuntimeTier("epic")).toEqual({
      cpu: 4096,
      memory: 8192,
      desiredCount: 1,
      efsProvisionedThroughputMibps: 32,
    });
  });

  test("turns live AWS state into run-store artifacts", () => {
    expect(
      toAwsRuntimeArtifact({
        provider: "aws",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
        serviceName: "slot-blitz-torii-bltz-fire-gate-42",
        status: "existing",
        endpointUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
        tier: "basic",
        version: "v1.8.16",
        region: "us-east-1",
        clusterArn: "arn:aws:ecs:cluster/runtime",
        serviceArn: "arn:aws:ecs:service/runtime/bltz",
        taskDefinitionArn: "arn:aws:ecs:task-definition/torii:1",
        targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/torii",
        efsAccessPointId: "fsap-123",
        imageDigest: "sha256:abc",
        health: {
          status: "healthy",
          checkedAt: "2026-06-22T00:00:00.000Z",
          endpoint: "https://runtime.realms.world/x/bltz-fire-gate-42/torii/health",
        },
      }),
    ).toEqual({
      provider: "aws",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      serviceName: "slot-blitz-torii-bltz-fire-gate-42",
      region: "us-east-1",
      clusterArn: "arn:aws:ecs:cluster/runtime",
      serviceArn: "arn:aws:ecs:service/runtime/bltz",
      taskDefinitionArn: "arn:aws:ecs:task-definition/torii:1",
      targetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/torii",
      efsAccessPointId: "fsap-123",
      endpointUrl: "https://runtime.realms.world/x/bltz-fire-gate-42/torii",
      tier: "basic",
      version: "v1.8.16",
      imageDigest: "sha256:abc",
      health: {
        status: "healthy",
        checkedAt: "2026-06-22T00:00:00.000Z",
        endpoint: "https://runtime.realms.world/x/bltz-fire-gate-42/torii/health",
      },
    });
  });

  test("builds create commands with EFS, task definition, ALB routing, and ECS service", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "efs create-access-point") {
        return okAwsCommand("fsap-123\n");
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:1\n");
      }

      if (args.slice(0, 2).join(" ") === "elbv2 create-target-group") {
        return okAwsCommand("arn:aws:elasticloadbalancing:targetgroup/runtime/123\n");
      }

      return okAwsCommand();
    });

    await backend.createRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      rpcUrl: "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
      worldAddress: "0x123",
      namespaces: "s1_eternum",
      tier: "basic",
      version: "v1.8.16",
    });

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "efs create-access-point",
      "ecs register-task-definition",
      "elbv2 create-target-group",
      "elbv2 create-rule",
      "ecs create-service",
    ]);
    expect(commands[0]).toContain(
      "Path=/runtimes/slot-blitz-torii-bltz-fire-gate-42,CreationInfo={OwnerUid=1000,OwnerGid=1000,Permissions=750}",
    );
    expect(commands[1]).toContain("--volumes");
    expect(commands[2]).toContain("/x/bltz-fire-gate-42/torii/health");
    expect(commands[3]).toContain("Field=path-pattern,Values=/x/bltz-fire-gate-42/torii,/x/bltz-fire-gate-42/torii/*");
    expect(commands[4]).toContain(
      "awsvpcConfiguration={subnets=[subnet-a,subnet-b],securityGroups=[sg-runtime],assignPublicIp=DISABLED}",
    );
  });

  test("CLI carries external contracts into the Torii task definition", () => {
    configureAwsRuntimeEnv();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-runtime-cli-"));
    const commandLogPath = path.join(tempDir, "commands.jsonl");
    const statePath = path.join(tempDir, "state.json");
    writeFakeAwsCli(tempDir);

    const result = spawnSync(
      "bun",
      [
        "config/deployer/clean/cli/aws-runtime.ts",
        "--operation",
        "deploy",
        "--environment",
        "slot.blitz",
        "--runtime-kind",
        "torii",
        "--runtime-name",
        "bltz-fire-gate-42",
        "--rpc-url",
        "https://runtime.realms.world/x/eternum-slot/katana/rpc/v0_9",
        "--world-address",
        "0x123",
        "--external-contracts",
        "erc20:0xabc\nerc721:0xdef",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          AWS_COMMAND_LOG: commandLogPath,
          AWS_STATE_FILE: statePath,
          PATH: `${tempDir}:${process.env.PATH}`,
        },
      },
    );

    expect(result.status).toBe(0);
    const registerCommand = findCommand(readLoggedAwsCommands(commandLogPath), "ecs register-task-definition");
    const containers = readJsonArg<Array<{ environment: Array<{ name: string; value: string }> }>>(
      registerCommand,
      "--container-definitions",
    );
    expect(containers[0]?.environment).toContainEqual({
      name: "TORII_EXTERNAL_CONTRACTS",
      value: "erc20:0xabc\nerc721:0xdef",
    });
  });

  test("updates service tags when resizing a runtime tier", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "ecs register-task-definition") {
        return okAwsCommand("arn:aws:ecs:task-definition/slot-blitz-torii-bltz-fire-gate-42:2\n");
      }

      return okAwsCommand();
    });

    await backend.updateRuntimeTier({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
      tier: "epic",
      version: "v1.8.16",
    });

    const tagCommand = findCommand(commands, "ecs tag-resource");
    expect(tagCommand).toContain("arn:aws:ecs:service/runtime/bltz-fire-gate-42");
    expect(tagCommand).toContain("key=RuntimeTier,value=epic");
  });

  test("deletes AWS routing, storage, and ECS resources for a runtime", async () => {
    configureAwsRuntimeEnv();
    const commands: string[][] = [];
    const backend = createAwsRuntimeCommandBackend((args) => {
      commands.push(args);

      if (args.slice(0, 2).join(" ") === "ecs describe-services") {
        return okAwsCommand(activeRuntimeServicePayload());
      }

      if (args.slice(0, 2).join(" ") === "elbv2 describe-rules") {
        return okAwsCommand(
          JSON.stringify({
            Rules: [
              {
                RuleArn: "arn:aws:elasticloadbalancing:listener-rule/runtime/123",
                Priority: "10234",
                Actions: [
                  {
                    Type: "forward",
                    TargetGroupArn: "arn:aws:elasticloadbalancing:targetgroup/runtime/123",
                  },
                ],
              },
            ],
          }),
        );
      }

      return okAwsCommand();
    });

    await backend.deleteRuntime({
      environmentId: "slot.blitz",
      runtimeKind: "torii",
      runtimeName: "bltz-fire-gate-42",
    });

    expect(commands.map((command) => command.slice(0, 2).join(" "))).toEqual([
      "ecs describe-services",
      "elbv2 describe-rules",
      "elbv2 delete-rule",
      "ecs delete-service",
      "ecs wait",
      "elbv2 delete-target-group",
      "efs delete-access-point",
    ]);
  });

  test("classifies missing AWS foundation configuration failures", async () => {
    restoreAwsEnv();
    const backend = createAwsRuntimeCommandBackend(() => okAwsCommand());

    await expect(
      backend.createRuntime({
        environmentId: "slot.blitz",
        runtimeKind: "torii",
        runtimeName: "bltz-fire-gate-42",
      }),
    ).rejects.toThrow("Missing AWS runtime foundation config");

    expect(classifyAwsRuntimeFailure(new Error("Missing AWS runtime foundation config: AWS_RUNTIME_ECR_IMAGE"))).toBe(
      "missing-foundation-config",
    );
  });
});
