#!/usr/bin/env bun
/**
 * Enrols a community shard's operator before its first deployment: the operator signs in to their own Realms account
 * with an emailed code, and our guardian approves the shard's deployer key as that account's first device on the
 * shard's chain. Initialization deploys the operator account with this approval. Run it once, after `prepare`:
 *
 *   docker compose run --rm -it --no-deps --entrypoint bun init deploy/athanor/scripts/enrol-operator.ts /data
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import { enrolOperator } from "../../../packages/identity/src/operator-enrolment";

const [directory] = process.argv.slice(2);
if (!directory) throw new Error("Usage: bun enrol-operator.ts DATA_DIRECTORY");

const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(directory, name), "utf8")) as T;

/** The identity API whose guardian the shard names: GUARDIAN_URL is its /guardian route. */
const identityUrlOf = (guardianUrl: string): string => {
  if (!guardianUrl.endsWith("/guardian")) throw new Error(`GUARDIAN_URL ${guardianUrl} is not a /guardian route`);
  return guardianUrl.slice(0, -"/guardian".length);
};

const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const email = (await terminal.question("Email of your Realms account: ")).trim();
  const enrolment = await enrolOperator({
    identityUrl: identityUrlOf(process.env.GUARDIAN_URL ?? ""),
    shard: readJson<{ shard: { chainId: string; accountClassHash: string; guardianPublicKey: string } }>(
      "native-world.json",
    ).shard,
    deviceKey: readJson<{ deployer: { publicKey: string } }>("host-accounts.json").deployer.publicKey,
    email,
    readCode: async () => (await terminal.question(`Sign-in code sent to ${email}: `)).trim(),
  });
  writeFileSync(resolve(directory, "operator-enrolment.json"), `${JSON.stringify(enrolment)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ event: "operator_enrolled", realmsId: enrolment.realmsId }));
} finally {
  terminal.close();
}
