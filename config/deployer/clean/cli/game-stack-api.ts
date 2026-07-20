#!/usr/bin/env bun
import { createAwsGameStackApiHandler } from "../runtime/aws/game-stack-api";

function main(): void {
  const handler = createAwsGameStackApiHandler({
    tableName: requireEnvironment("AWS_RUNTIME_CONTROL_TABLE_NAME"),
    region: process.env.AWS_REGION || "us-east-2",
    mainnetRpcUrl: requireEnvironment("MAINNET_RPC_URL"),
    seasonIntentReaderUrl: requireEnvironment("SEASON_INTENT_READER_URL"),
    orchestratorUrl: requireEnvironment("BLITZ_GAME_STACK_ORCHESTRATOR_URL"),
    serviceToken: requireEnvironment("BLITZ_CONTROL_PLANE_SERVICE_TOKEN"),
  });

  const port = parsePort(process.env.PORT);
  Bun.serve({ port, fetch: handler });
  process.stdout.write(`${JSON.stringify({ event: "game-stack-api-listening", port })}\n`);
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Game-stack API requires ${name}`);
  return value;
}

function parsePort(value: string | undefined): number {
  const port = Number(value || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be an integer from 1 to 65535");
  return port;
}

if (import.meta.main) main();
