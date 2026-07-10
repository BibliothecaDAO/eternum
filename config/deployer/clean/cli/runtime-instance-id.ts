#!/usr/bin/env bun
import { deriveDeterministicRuntimeInstanceId } from "../runtime/runtime-identity";

try {
  console.log(deriveDeterministicRuntimeInstanceId(parseSeedParts(process.argv.slice(2))));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseSeedParts(args: string[]): string[] {
  const seedParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--seed-part") {
      throw new Error(`Unexpected runtime instance ID argument: ${args[index]}`);
    }

    const seedPart = args[index + 1];
    if (!seedPart || seedPart.startsWith("--")) {
      throw new Error("--seed-part requires a non-empty value");
    }
    seedParts.push(seedPart);
    index += 1;
  }

  return seedParts;
}
