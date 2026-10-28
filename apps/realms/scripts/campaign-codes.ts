/**
 * A campaign's printed codes: N codes, the campaign's golden count of them golden, each one flyer.
 *
 *   CAMPAIGN_CODE_SEED=<secret> pnpm --dir apps/realms campaign-codes devcon-2026 1000 https://play.realms.party <out>
 *
 * writes into <out>:
 * - `qr/0001.svg` … one QR per printed flyer, in print order, each to `<base>/join/devcon/<code>`;
 * - `print.csv`: page, QR file and address, for the printer's variable data. Nothing in it says which pages are golden:
 *   the print order is shuffled;
 * - `codes.sql`: every code hashed with its tier, for the identity Worker's D1
 *   (`wrangler d1 execute <database> --remote --file <out>/codes.sql`). Safe to run twice.
 *
 * The same seed, count and base give the same files, so a lost print file is made again rather than reissued. Whoever
 * holds the seed can tell the golden codes: keep it with the deployment's secrets.
 */
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";

import {
  CAMPAIGNS,
  CODE_ALPHABET,
  CODE_LENGTH,
  campaignCodeHash,
  isCampaignKey,
  type CampaignKey,
} from "../server/campaigns";

/** The Chart ground of the Realms brand: umber ink on parchment, as flyer B's QR card prints it. */
const QR_COLOURS = { dark: "#2a1f14", light: "#f1e7d4" };

async function main() {
  const { campaign, count, base, out, seed } = readArguments(process.argv.slice(2), process.env.CAMPAIGN_CODE_SEED);
  const codes = generateCodes(campaign, count, seed);
  const golden = new Set(codes.slice(0, CAMPAIGNS[campaign].golden));
  const printed = printOrder(campaign, codes, seed);
  mkdirSync(join(out, "qr"), { recursive: true });
  const rows = ["page,qr,url"];
  for (const [index, code] of printed.entries()) {
    const page = String(index + 1).padStart(4, "0");
    const url = `${base}${CAMPAIGNS[campaign].link}/${code}`;
    writeFileSync(join(out, "qr", `${page}.svg`), await qrSvg(url));
    rows.push(`${page},qr/${page}.svg,${url}`);
  }
  writeFileSync(join(out, "print.csv"), `${rows.join("\n")}\n`);
  writeFileSync(join(out, "codes.sql"), await codesSql(campaign, codes, golden));
  console.log(JSON.stringify({ campaign, codes: codes.length, golden: golden.size, out }));
}

function readArguments(args: string[], seed: string | undefined) {
  const [campaign, count, base, out] = args;
  if (!isCampaignKey(campaign)) throw new Error(`Campaigns: ${Object.keys(CAMPAIGNS).join(", ")}.`);
  const flyers = Number(count);
  if (!Number.isInteger(flyers) || flyers < CAMPAIGNS[campaign].golden || flyers > 100_000)
    throw new Error(`Print at least ${CAMPAIGNS[campaign].golden} flyers, at most 100000.`);
  if (!base || !/^https:\/\/[^/]+$/.test(base)) throw new Error("The site's base, as https://host with no path.");
  if (!out) throw new Error("Name the directory to write into.");
  if (!seed || seed.length < 32) throw new Error("CAMPAIGN_CODE_SEED must hold at least 32 secret characters.");
  return { campaign, count: flyers, base, out, seed };
}

/** Distinct codes drawn from the seed: 40 bits each, five per letter of the alphabet's 32. */
function generateCodes(campaign: CampaignKey, count: number, seed: string): string[] {
  const codes = new Set<string>();
  for (let draw = 0; codes.size < count; draw++) {
    const bytes = createHmac("sha256", seed).update(`${campaign}:code:${draw}`).digest();
    let bits = 0n;
    for (const byte of bytes.subarray(0, 5)) bits = (bits << 8n) | BigInt(byte);
    let code = "";
    for (let letter = 0; letter < CODE_LENGTH; letter++)
      code += CODE_ALPHABET[Number((bits >> BigInt(5 * letter)) & 31n)];
    codes.add(code);
  }
  return [...codes];
}

/** The order the flyers print in, from the seed: no page number tells a golden flyer from another. */
const printOrder = (campaign: CampaignKey, codes: string[], seed: string) =>
  codes
    .map((code) => ({ code, rank: createHmac("sha256", seed).update(`${campaign}:page:${code}`).digest("hex") }))
    .sort((a, b) => a.rank.localeCompare(b.rank))
    .map(({ code }) => code);

const qrSvg = (url: string) =>
  QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: QR_COLOURS });

async function codesSql(campaign: CampaignKey, codes: string[], golden: Set<string>) {
  const rows = await Promise.all(
    codes.map(
      async (code) =>
        `('${campaign}', '${await campaignCodeHash(campaign, code)}', '${golden.has(code) ? "golden" : "regular"}')`,
    ),
  );
  // Sorted by hash, so the file's order says nothing of the tier either; 100 rows a statement keeps each within D1's
  // statement size.
  rows.sort();
  const statements = [];
  for (let start = 0; start < rows.length; start += 100)
    statements.push(
      `INSERT INTO "campaign_codes" ("campaign", "code_hash", "tier") VALUES\n${rows.slice(start, start + 100).join(",\n")}\nON CONFLICT DO NOTHING;\n`,
    );
  return statements.join("");
}

await main();
