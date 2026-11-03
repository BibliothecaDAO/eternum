/**
 * A code every flyer of a campaign shares, as SQL for the identity Worker's D1: each account that brings it draws one of
 * the campaign's unspent printed codes (server/campaign-tickets.ts).
 *
 *   CAMPAIGN_SHARED_CODE=<code> pnpm --dir apps/realms campaign-shared-code devcon-2026 <out.sql>
 *   wrangler d1 execute <database> --remote --file <out.sql>
 *
 * The code comes from the environment so it stays off the command line; the file holds only its hash. Safe to run twice.
 */
import { writeFileSync } from "node:fs";

import { isCampaignKey } from "@realms-world/identity";

import { campaignCodeHash, readCampaignCode } from "../server/campaigns";

const [campaign, out] = process.argv.slice(2);
if (!isCampaignKey(campaign)) throw new Error("Name the campaign the code belongs to.");
if (!out) throw new Error("Name the SQL file to write.");
const code = readCampaignCode(process.env.CAMPAIGN_SHARED_CODE);
if (!code) throw new Error("CAMPAIGN_SHARED_CODE must hold a code as flyers print it.");
const hash = await campaignCodeHash(campaign, code);
writeFileSync(
  out,
  `INSERT INTO "campaign_shared_codes" ("campaign", "code_hash") VALUES ('${campaign}', '${hash}') ON CONFLICT DO NOTHING;\n`,
  { mode: 0o600 },
);
console.log(JSON.stringify({ campaign, out }));
