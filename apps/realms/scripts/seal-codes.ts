import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { codeHashInScope } from "../server/campaigns";
import { generateCodes, readCodeSeed } from "./printed-codes";

const USAGE =
  "CAMPAIGN_CODE_SEED=<secret> pnpm --dir apps/realms seal-codes <staging|production> <label> <count> <out> [last day YYYY-MM-DD]";
const ENVIRONMENTS = ["staging", "production"] as const;
type Environment = (typeof ENVIRONMENTS)[number];
const MOST_CODES = 10_000;
const SQL_ROWS_A_STATEMENT = 100;

type SealCodeOrder = { label: string; count: number; expiresAt: number | null };

const main = async () => {
  const [environment, label, count, out, lastDay] = process.argv.slice(2);
  const target = readEnvironment(environment);
  if (!out) throw new Error(`Name the directory to write into. ${USAGE}`);
  const order = readSealCodeOrder([label, count, lastDay], Date.now());
  const { codes, sql } = await sealCodeFiles(order, readCodeSeed(process.env.CAMPAIGN_CODE_SEED));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "codes.txt"), `${codes.join("\n")}\n`, { mode: 0o600 });
  writeFileSync(join(out, "codes.sql"), sql);
  loadCodes(target, resolve(out, "codes.sql"));
  console.log(JSON.stringify({ ...order, environment: target, out }));
};

export function readEnvironment(value: string | undefined): Environment {
  const environment = ENVIRONMENTS.find((name) => name === value);
  if (!environment) throw new Error(`Name the environment whose players redeem the codes. ${USAGE}`);
  return environment;
}

export const d1LoadArgs = (environment: Environment, file: string) => [
  "exec",
  "wrangler",
  "d1",
  "execute",
  "DB",
  "--remote",
  "--env",
  environment,
  "--file",
  file,
];

const loadCodes = (environment: Environment, file: string) => {
  const worker = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const loaded = spawnSync("pnpm", d1LoadArgs(environment, file), { cwd: worker, stdio: "inherit" });
  if (loaded.status !== 0)
    throw new Error(
      `Loading the codes into ${environment} failed. Run the same command again: it loads each code once.`,
    );
};

export function readSealCodeOrder([label, count, lastDay]: (string | undefined)[], now: number): SealCodeOrder {
  if (!label || !/^[a-z0-9-]{1,40}$/.test(label))
    throw new Error(`Label the codes for whom they are, in lowercase letters, digits and dashes. ${USAGE}`);
  const codes = Number(count);
  if (!Number.isInteger(codes) || codes < 1 || codes > MOST_CODES)
    throw new Error(`Write at least 1 code, at most ${MOST_CODES}. ${USAGE}`);
  return { label, count: codes, expiresAt: lastDay === undefined ? null : endOfDay(lastDay, now) };
}

const endOfDay = (lastDay: string, now: number) => {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lastDay);
  const end = day ? Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]) + 1) : Number.NaN;
  if (!day || new Date(end - 1).toISOString().slice(0, 10) !== lastDay)
    throw new Error(`The last day a code works, as YYYY-MM-DD. ${USAGE}`);
  if (end <= now) throw new Error(`${lastDay} has passed. ${USAGE}`);
  return end / 1000;
};

export async function sealCodeFiles({ label, count, expiresAt }: SealCodeOrder, seed: string) {
  const codes = generateCodes(`seal:${label}`, count, seed);
  const rows = await Promise.all(
    codes.map(async (code) => `('${await codeHashInScope("seal", code)}', '${label}', ${expiresAt ?? "NULL"})`),
  );
  rows.sort();
  const statements = [];
  for (let start = 0; start < rows.length; start += SQL_ROWS_A_STATEMENT)
    statements.push(
      `INSERT INTO "seal_codes" ("code_hash", "label", "expires_at") VALUES\n${rows.slice(start, start + SQL_ROWS_A_STATEMENT).join(",\n")}\nON CONFLICT DO NOTHING;\n`,
    );
  return { codes, sql: statements.join("") };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
