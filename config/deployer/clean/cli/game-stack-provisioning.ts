#!/usr/bin/env bun
import { createAwsGameStackProvisioningServiceHandler } from "../runtime/aws/game-stack-provisioning";
import { readA23ReleaseAuthorizationVerification } from "../runtime/aws/wave0-release";

function main(): void {
  const handler = createAwsGameStackProvisioningServiceHandler({
    tableName: requireEnvironment("AWS_RUNTIME_CONTROL_TABLE_NAME"),
    region: process.env.AWS_REGION || "us-east-2",
    operationsUrl: requireEnvironment("BLITZ_GAME_STACK_OPERATIONS_URL"),
    registryUrl: requireEnvironment("RUNTIME_REGISTRY_URL"),
    registryAdminSecret: requireEnvironment("FACTORY_WORKER_ADMIN_SECRET"),
    serviceToken: requireEnvironment("BLITZ_CONTROL_PLANE_SERVICE_TOKEN"),
    releaseAuthorization: readA23ReleaseAuthorizationVerification(process.env),
  });
  const port = parsePort(process.env.PORT);
  Bun.serve({ port, fetch: handler });
  process.stdout.write(`${JSON.stringify({ event: "game-stack-provisioning-listening", port })}\n`);
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Game-stack provisioning requires ${name}`);
  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer from 1 to 65535");
  return port;
}

if (import.meta.main) main();
