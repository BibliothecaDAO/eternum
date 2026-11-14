// The Devcon Season 0 comeback email: one email in three variants, sent from the identity Worker's sender (Realms
// <no-reply@realms.party>, Resend). Its words and its send-record key come from a copy folder outside the repo
// (comeback-copy.ts), checked against the live figures before anything goes. Every figure is read when it runs: the
// players, the chests won and the LORDS left from Herald, the LORDS price from CoinGecko, a ticket home's daily claim,
// regular and golden, from the game's LaborRules row; the invite's odds and count from the Devcon campaign
// (packages/identity/src/campaigns.ts). Each email carries its account's stop link (server/news-email-opt-out.ts) as a
// footer link and as List-Unsubscribe headers.
//   pnpm --dir apps/realms comeback-email dry-run --copy <copy> [--env dev]  recipients per variant, counts only
//   pnpm --dir apps/realms comeback-email render <dir> --copy <copy>         each copy file's HTML (header inlined), text
//   pnpm --dir apps/realms comeback-email test <address> --copy <copy>       each copy file once to that address
//   pnpm --dir apps/realms comeback-email send <D,N,P> --copy <copy> [--discord]  the campaign, after the owner's go
// The environment's Resend key, auth secret and Cloudflare token come from its private directory and are never printed;
// no player's email address is printed either.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import sharp from "sharp";
import { campaignHomeClaim, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import { CAMPAIGNS } from "@realms-world/identity";
import environments from "../../../deploy/first/environments.json";
import playtest from "../../../packages/core/src/sync/season-archives/playtest.json";
import { sendEmail, type Email } from "../../../packages/notifications/src/email";
import BRAND from "../../../packages/notifications/src/brand.gen.json";
import { newsEmailOptOutLink } from "../server/news-email-opt-out";
import {
  copyFiles,
  copyFor,
  fillCopy,
  loadCopy,
  type Block,
  type Copy,
  type CopyFolder,
  type Figures,
} from "./comeback-copy";
import {
  Activity,
  awaySince,
  isAway,
  sendCampaign,
  stillFits,
  sendRecord,
  type HistoryEvent,
  type LaborGrant,
  visitRecord,
  variantOf,
  wranglerFailure,
  type Account,
  type Delivery,
  type Handoff,
  type Reservation,
  type VariantKey,
} from "./comeback-campaign";

const HERALD = "https://herald.realms.party";
const GAME = 1;
const TICKETS = "devcon-2026";

/**
 * Where each environment's accounts live, and its app origin as the deployer publishes it
 * (deploy/first/environments.json). The season's numbers always come from production's Herald.
 */
const TARGETS = {
  production: { ...addressesOf("production"), store: ".realms-production", database: "realms-identity-production" },
  dev: { ...addressesOf("dev"), store: ".realms-dev", database: "realms-identity-staging" },
} as const;
type Target = (typeof TARGETS)[keyof typeof TARGETS];

type Row = Record<string, any>;

function addressesOf(name: keyof typeof environments) {
  const environment = environments[name];
  return { app: environment.origin, wranglerEnv: environment.worker };
}

// ---- What the email says, read live ---------------------------------------------------------------------------------

interface Season {
  players: number;
  pool: number;
  won: number;
  left: number;
  prize: number;
  usdLeft: number;
  endsAt: number;
  rules: LaborRuleAmounts;
  /** Each player's latest confirmed action (Herald's history and daily claims); caught up before each send. */
  activity: Activity;
  /** The block the claims were last read at (the snapshot's confirmed head when they were read). */
  confirmedBlock: number;
  seasonPlayers: Set<string>;
}

const herald = async (path: string): Promise<Row> => {
  const response = await fetch(`${HERALD}${path}`, { headers: { "user-agent": "realms-comeback-email" } });
  if (!response.ok) throw new Error(`Herald ${path}: ${response.status}`);
  return response.json() as Promise<Row>;
};

const norm = (address: string) => `0x${BigInt(address).toString(16)}`;

async function readSeason(): Promise<Season> {
  const [directory, snapshot, board, history, price] = await Promise.all([
    herald("/games"),
    herald(`/games/${GAME}/snapshot`),
    herald(`/games/${GAME}/leaderboard`),
    readHistory(),
    readLordsPrice(),
  ]);
  const game = (directory.games as Row[]).find((entry) => entry.game_id === GAME)!;
  const model = (name: string) =>
    (snapshot.models as Row[]).find((entry) => entry.model === name)?.rows.map((row: Row) => row.value) ?? [];
  const budget = model("LordsBudget")[0];
  const prize = Number(BigInt(model("FrontierPrize")[0].pool));
  const left = Number(BigInt(budget.pool_left));
  const activity = new Activity({
    seed: BigInt(game.expedition.seed),
    startMainAt: Number(game.clock.start_main_at),
    scheduledEndAt: Number(game.clock.scheduled_end_at),
endAt: Number(game.clock.end_at),
    dayUnitSeconds: Number(game.expedition.day_unit_seconds),
  });
  activity.noteHistory(history as HistoryEvent[]);
  activity.noteClaims(model("LaborGrant") as LaborGrant[]);
  return {
    players: Number(game.player_count),
    pool: Number(BigInt(budget.pool)) + prize,
    won: (board.entries as Row[]).reduce((sum, entry) => sum + Number(entry.rewards?.lords ?? 0), 0),
    left,
    prize,
    usdLeft: left * price,
    endsAt: Number(game.clock.end_at),
    rules: model("LaborRules")[0] as LaborRuleAmounts,
    activity,
    confirmedBlock: Number(snapshot.confirmed_block),
    seasonPlayers: new Set(model("PlayerEntry").map((entry: Row) => norm(entry.owner))),
  };
}

async function readHistory(): Promise<Row[]> {
  const events: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await herald(`/games/${GAME}/history?limit=500&offset=${offset}`);
    events.push(...(page.items as Row[]));
    if (offset + 500 >= page.total) return events;
  }
}

/**
 * Reads the confirmed activity since the season was read: the daily claims again (one small snapshot read, which also
 * names its confirmed block), then Herald's history, newest first, until a page reaches a block already held.
 */
async function catchUpActivity(season: Season) {
  const claims = await herald(`/games/${GAME}/snapshot?models=LaborGrant`);
  const fresh: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await herald(`/games/${GAME}/history?limit=500&offset=${offset}`);
    fresh.push(...(page.items as Row[]));
    const reachedHeld = (page.items as Row[]).some((event) => Number(event.block_number) <= season.activity.heldBlock);
    if (reachedHeld || offset + 500 >= page.total) break;
  }
  season.activity.noteHistory(fresh as HistoryEvent[]);
  season.activity.noteClaims((claims.models as Row[])[0]?.rows.map((row: Row) => row.value) ?? []);
  season.confirmedBlock = Number(claims.confirmed_block);
}

async function readLordsPrice(): Promise<number> {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=lords&vs_currencies=usd");
  if (!response.ok) throw new Error(`CoinGecko: ${response.status}`);
  const usd = ((await response.json()) as Row).lords?.usd;
  if (typeof usd !== "number" || !(usd > 0)) throw new Error("CoinGecko: no LORDS price");
  return usd;
}

// ---- Who gets which variant (counts only leave this file) -----------------------------------------------------------

/** A campaign account with the player addresses it owns, in memory only. */
type Reached = Account & { addresses: readonly string[] };
/** The same with its email address, read only by a send. */
type Recipient = Reached & { email: string };

/** When the environment's visit record began (migration 0026), in seconds; null where it has not run. */
const visitsSinceOf = (target: Target) => visitRecord.beganAt(d1(target, visitRecord.began));

/** Every account with a verified email, as comeback-campaign.ts decides on them; addresses only when asked for. */
function readAccounts(
  target: Target,
  season: Season,
  withEmail: boolean,
  visitsRecorded: boolean,
): (Reached & { email?: string })[] {
  const users = d1(
    target,
    `SELECT u.realmsId, u.newsEmailOptOutAt, ${visitsRecorded ? "u.lastSeenAt" : "NULL AS lastSeenAt"}, ${withEmail ? "u.email, " : ""}EXISTS (SELECT 1 FROM account a WHERE a.userId = u.id AND a.providerId = 'discord') AS discord FROM "user" u WHERE u.emailVerified = 1 AND u.realmsId IS NOT NULL`,
  );
  const tickets = new Map(
    d1(target, `SELECT owner, tier FROM campaign_tickets WHERE campaign = '${TICKETS}'`).map((row) => [
      row.owner,
      row.tier,
    ]),
  );
  const addresses = new Map<string, string[]>();
  for (const row of d1(target, `SELECT address, realmsId FROM realms_accounts`))
    addresses.set(row.realmsId, [...(addresses.get(row.realmsId) ?? []), norm(row.address)]);
  const playtesters = new Set((playtest as Row).leaderboard.entries.map((entry: Row) => norm(entry.address)));
  return users.map((user) => {
    const owned = addresses.get(user.realmsId) ?? [];
    return {
      realmsId: user.realmsId,
      discord: Boolean(user.discord),
      ticket: tickets.get(user.realmsId) ?? null,
      playtester: owned.some((address) => playtesters.has(address)),
      inSeason: owned.some((address) => season.seasonPlayers.has(address)),
      lastAction: season.activity.latestOf(owned),
      lastVisit: visitRecord.seconds(user.lastSeenAt),
      addresses: owned,
      optedOut: user.newsEmailOptOutAt != null,
      ...(withEmail ? { email: String(user.email) } : {}),
    };
  });
}

/** One statement against the environment's identity D1, through wrangler with the deployer's Cloudflare token. */
function d1(target: Target, query: string): Row[] {
  if (query.includes(";")) throw new Error("refused: one statement at a time");
  const store = privateFile<{ cloudflareToken: string }>(target, "inputs.json");
  const run = spawnSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      target.database,
      "--remote",
      "--env",
      target.wranglerEnv,
      "--json",
      "--command",
      query,
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env: { ...process.env, CLOUDFLARE_API_TOKEN: store.cloudflareToken },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (run.status !== 0) throw new Error(wranglerFailure(run.status, `${run.stderr}\n${run.stdout}`));
  return JSON.parse(run.stdout)[0].results;
}

/**
 * Reserves the account in the send record before its email goes, in one statement that also checks the account has not
 * stopped news emails, so an interrupted or parallel run never sends it again.
 */
function reserveSend(target: Target, campaign: string, delivery: Delivery): Reservation {
  if (d1(target, sendRecord.reserve(campaign, delivery, Date.now())).length) return "reserved";
  return d1(target, sendRecord.optedOut(delivery))[0]?.newsEmailOptOutAt != null ? "opted_out" : "taken";
}

const privateFile = <T>(target: Target, name: string): T =>
  JSON.parse(readFileSync(`${process.env.HOME}/${target.store}/${name}`, "utf8")) as T;

// ---- The email ------------------------------------------------------------------------------------------------------

/** The Devcon referral as the identity Worker settles it (packages/identity/src/campaigns.ts). */
const { referral: REFERRAL } = CAMPAIGNS[TICKETS];

const n = (value: number) => {
  if (!Number.isFinite(value)) throw new Error("a figure has no value");
  return Math.round(value).toLocaleString("en-US");
};
/** LORDS left, rounded down to the thousand so "about" never overstates. */
const about = (lords: number) => n(Math.floor(lords / 1000) * 1000);
/** A dollar figure to two significant digits: "around $1,000". */
const dollars = (usd: number) => `$${n(Number(usd.toPrecision(2)))}`;
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const daysLeft = (s: Season) => {
  const days = Math.floor((s.endsAt - Date.now() / 1000) / 86400);
  return days <= 0 ? "Last day" : `${WORDS[days] ?? n(days)} day${days === 1 ? "" : "s"} left`;
};
/** The season's end as Herald serves it when the run starts, dated, so an extended season reads its new day. */
const endsAt = (s: Season) => {
  const end = new Date(s.endsAt * 1000);
  const day = end.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const time = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day} at ${time} UTC`;
};

/** Every figure a copy file may name, worded for one reader: their claim is golden when their ticket is. */
function figuresFor(s: Season, golden: boolean): Figures {
  const claim = campaignHomeClaim(s.rules, golden);
  const gold = campaignHomeClaim(s.rules, true);
  return {
    players: n(s.players),
    pool: n(s.pool),
    won: n(s.won),
    left: about(s.left),
    usdLeft: dollars(s.usdLeft),
    prize: n(s.prize),
    daysLeft: daysLeft(s),
    endsAt: endsAt(s),
    claimLabor: n(claim.labor),
    claimEssence: n(claim.essence),
    goldenLabor: n(gold.labor),
    goldenEssence: n(gold.essence),
    goldenOneIn: n(1 / REFERRAL.goldenOdds),
    goldenLinkAt: n(REFERRAL.goldenLinkAt),
  };
}

const HEADER_ID = "header";

/** Who one email is for: their address, their app, their stop link, and whether their ticket is golden. */
interface Reader {
  to: string;
  app: string;
  optOut: string;
  golden: boolean;
}

function buildEmail(
  copy: CopyFolder,
  key: VariantKey,
  s: Season,
  reader: Reader,
  header: string,
  subjectPrefix = "",
): Email {
  const words = fillCopy(copyFor(copy, key, reader.golden), figuresFor(s, reader.golden));
  const subject = `${subjectPrefix}${words.subject}`;
  const text = [
    ...words.blocks.flatMap((block) => textOf(block, words.action, reader)),
    `Realms · Frontier · Devcon Season 0\nSent to ${reader.to}, the email of your Realms account.\nStop these emails: ${reader.optOut}\nPrivacy: ${reader.app}/privacy`,
  ].join("\n\n");
  return {
    sender: "Realms",
    to: reader.to,
    subject,
    text,
    html: emailHtml(subject, words, reader, s),
    images: [{ id: HEADER_ID, filename: "devcon-season-0.jpg", content: header }],
    headers: { "List-Unsubscribe": `<${reader.optOut}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

/** A block in the text part: the prize board is HTML only; the button and links spell out their address. */
function textOf(block: Block, action: string, reader: Reader): string[] {
  if (block.kind === "prizes") return [];
  if (block.kind === "button") return [`${action}: ${reader.app}`];
  if (block.kind === "link") return [`${block.text} ${reader.app}${block.path}`];
  return [block.text];
}

/** Fills every copy file for its reader, so a copy that cannot be filled stops a run before any email goes. */
function checkCopy(copy: CopyFolder, s: Season) {
  for (const file of copyFiles(copy)) fillCopy(file.template, figuresFor(s, file.golden));
}

const {
  ground: NIGHT,
  plate: PLATE,
  line: LINE,
  cream: CREAM,
  muted: MUTED,
  gold: GOLD,
  gold2: GOLD2,
  ink: INK,
} = BRAND.colors;
/** The Frontier lockup's violet, the Devcon season's colour on its flyer and poster. */
const VIOLET = "#b794f6";
const BODY = `'${BRAND.faces.body.family}','Segoe UI',Helvetica,Arial,sans-serif`;
const DISPLAY = `'${BRAND.faces.display.family}',Georgia,'Times New Roman',serif`;

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const row = (padding: string, content: string, style = "") =>
  `<tr><td class="px" style="padding:${padding};${style}">${content}</td></tr>`;
/** Paragraphs before the button are read; the ones after it are set smaller. */
const READING = `font-family:${BODY};font-size:17px;line-height:26px`;
const AFTER_BUTTON = `font-family:${BODY};font-size:15px;line-height:23px`;

/** One prize figure, drawn large: the number, then what it is. */
const stat = (figure: string, label: string, colour: string) =>
  `<td class="stat" width="50%" valign="top" style="padding:16px 12px;text-align:center;background:${PLATE};border:1px solid ${LINE}"><div class="figure" style="font-family:${DISPLAY};font-size:34px;line-height:40px;color:${colour}">${escape(figure)}</div><div style="font-family:${BODY};font-size:13px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};padding-top:4px">${escape(label)}</div></td>`;

function prizeBoard(s: Season) {
  const grid = (cells: string[]) => `<tr>${cells.join("")}</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:6px">${grid(
    [
      stat(n(s.pool), "LORDS up for grabs", GOLD2),
      stat(about(s.left), `still in chests · ~${dollars(s.usdLeft)}`, GOLD2),
    ],
  )}${grid([stat(n(s.prize), "LORDS for the top three", VIOLET), stat(n(s.players), "players in the season", VIOLET)])}</table>`;
}

/** One table row per block, spaced by what it follows. */
function blockRows(blocks: Block[], action: string, reader: Reader, s: Season) {
  const button = blocks.findIndex((block) => block.kind === "button");
  return blocks.map((block, index) => {
    const face = index > button ? AFTER_BUTTON : READING;
    if (block.kind === "prizes") return row("20px 34px 0", prizeBoard(s));
    if (block.kind === "button")
      return row(
        "28px 40px 0",
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${GOLD};border-radius:8px"><a href="${escape(reader.app)}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:17px;font-weight:700;color:${INK};text-decoration:none">${escape(action)} &rarr;</a></td></tr></table>`,
      );
    if (block.kind === "link")
      return row(
        "8px 40px 0",
        `<a href="${escape(`${reader.app}${block.path}`)}" style="${face};color:${GOLD};text-decoration:underline">${escape(block.text)}</a>`,
      );
    const padding = index === 0 ? "28px 40px 0" : index === button + 1 ? "32px 40px 0" : "16px 40px 0";
    const style = {
      plain: `${face};color:${CREAM}`,
      bold: `${face};color:${CREAM};font-weight:700`,
      callout: `${face};color:${CREAM};color:${GOLD2};font-weight:700`,
    }[block.style];
    return row(padding, escape(block.text), style);
  });
}

function emailHtml(subject: string, words: Copy, reader: Reader, s: Season) {
  const rows = [
    `<tr><td style="padding:0;line-height:0;font-size:0"><img src="cid:${HEADER_ID}" width="600" alt="Realms · Frontier · Devcon Season 0" style="width:100%;max-width:600px;height:auto;display:block;border-radius:12px 12px 0 0"></td></tr>`,
    ...blockRows(words.blocks, words.action, reader, s),
    row("32px 40px 0", `<div style="height:1px;line-height:1px;font-size:0;background:${LINE}">&nbsp;</div>`),
    row(
      "18px 40px 36px",
      `<a href="${escape(reader.app)}" style="color:${GOLD};text-decoration:none;font-weight:700">Realms</a> · Frontier · <span style="color:${VIOLET}">Devcon Season 0</span><br>Sent to ${escape(reader.to)}, the email of your Realms account.<br><a href="${escape(reader.optOut)}" style="color:${MUTED}">Stop these emails</a> · <a href="${escape(reader.app)}/privacy" style="color:${MUTED}">Privacy</a>`,
      `font-family:${BODY};font-size:13px;line-height:20px;color:${MUTED}`,
    ),
  ];
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<title>${escape(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%} table{border-collapse:collapse} img{border:0;outline:none;text-decoration:none}
@media (max-width:620px){ .px{padding-left:20px !important;padding-right:20px !important} .figure{font-size:26px !important;line-height:32px !important} .stat{padding:12px 6px !important} }
</style>
</head>
<body style="margin:0;padding:0;background:${NIGHT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(words.preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NIGHT}"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${NIGHT};border:1px solid ${LINE};border-radius:12px">
${rows.join("\n")}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`;
}

// ---- The header: the sign-in emails' painting under the Frontier lockup, lettered for Devcon -----------------------

const WIDTH = 1200; // drawn at 600: twice the pixels for sharp phones
const HEADER_LINE = "THE DEVCON SEASON · MUMBAI";
/** The game's public files: the sign-in emails' painting, the Frontier lockup and the heading face. */
const PUBLIC = new URL("../../game/public/", import.meta.url);
const HEIGHT = 640;

/** The header JPEG, in base64. */
async function drawHeader(): Promise<string> {
  const painting = await sharp(await readFile(new URL("images/landscapes/frontier-mist-1536.webp", PUBLIC)))
    .resize({ width: WIDTH })
    .toBuffer({ resolveWithObject: true });
  const crop = await sharp(painting.data)
    .extract({ left: 0, top: Math.round((painting.info.height - HEIGHT) * 0.45), width: WIDTH, height: HEIGHT })
    .toBuffer();
  const lockup = await sharp(await readFile(new URL(BRAND.marks.lockups.frontier.slice(1), PUBLIC)))
    .resize({ height: 400 })
    .png()
    .toBuffer({ resolveWithObject: true });
  // No digits: the heading face draws old-style figures, and its 0 reads as a letter.
  const line = await lettering(HEADER_LINE, GOLD2, 40);
  const shadow = await sharp((await lettering(HEADER_LINE, BRAND.colors.shade, 40)).data)
    .blur(3)
    .toBuffer();
  const lineTop = HEIGHT - 52 - line.info.height;
  const lineLeft = Math.round((WIDTH - line.info.width) / 2);
  return sharp(crop)
    .composite([
      { input: veil() },
      { input: lockup.data, left: Math.round((WIDTH - lockup.info.width) / 2), top: 48 },
      { input: shadow, left: lineLeft + 2, top: lineTop + 3 },
      { input: line.data, left: lineLeft, top: lineTop },
    ])
    .jpeg({ quality: 70, progressive: true, mozjpeg: true })
    .toBuffer()
    .then((jpeg) => Buffer.from(jpeg).toString("base64"));
}

/** The poster's violet storm over the top, night rising from the bottom under the lettering. */
const veil = () =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
<defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1745" stop-opacity="0.75"/><stop offset="0.55" stop-color="#2a1745" stop-opacity="0.25"/><stop offset="1" stop-color="#2a1745" stop-opacity="0"/></linearGradient>
<linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="${NIGHT}" stop-opacity="0"/><stop offset="1" stop-color="${NIGHT}" stop-opacity="0.95"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#v)"/><rect width="100%" height="100%" fill="url(#n)"/></svg>`);

const lettering = (text: string, colour: string, size: number) =>
  sharp({
    text: {
      text: `<span foreground="${colour}">${text}</span>`,
      font: `${BRAND.faces.display.family} ${size}`,
      fontfile: new URL(BRAND.faces.display.files[0]!.slice(1), PUBLIC).pathname,
      dpi: 96,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

// ---- Modes ----------------------------------------------------------------------------------------------------------

function figures(s: Season) {
  return {
    players: s.players,
    pool: s.pool,
    won: s.won,
    left: s.left,
    prize: s.prize,
    usdLeft: Math.round(s.usdLeft),
    endsAt: new Date(s.endsAt * 1000).toISOString(),
  };
}

/** This moment, in seconds: who has come back is decided against it (`awaySince`). */
const now = () => Math.floor(Date.now() / 1000);

async function dryRun(target: Target, copy: CopyFolder) {
  const season = await readSeason();
  checkCopy(copy, season);
  const at = now();
  const visitsSince = visitsSinceOf(target);
  const since = awaySince(at, visitsSince);
  const record = d1(target, `SELECT realmsId, status FROM news_email_sends WHERE campaign = '${copy.campaign}'`);
  const reserved = new Set(record.map((row) => row.realmsId));
  /** Reserved by a run that never marked them sent: check them against Resend's log before anything else. */
  const unresolved = record.filter((row) => row.status === "reserved").length;
  const counts = Object.fromEntries(
    (["D", "N", "P"] as const).map((key) => [
      key,
      {
        email: 0,
        discord: 0,
        golden: 0,
        alreadyReserved: 0,
        leftOut: { visited: 0, actedOnly: 0, visitsUnknown: 0 },
      },
    ]),
  );
  let optedOut = 0;
  for (const account of readAccounts(target, season, false, visitsSince !== null)) {
    if (account.optedOut) optedOut++;
    const key = variantOf(account, at, visitsSince);
    // Who the email would be for with no visit or action and a record long begun: the players it now leaves out, and
    // why.
    const candidate = variantOf({ ...account, lastAction: 0, lastVisit: 0 }, at, 0);
    if (!key) {
      if (candidate) counts[candidate]!.leftOut[leftOutBy(account, at, visitsSince)]++;
      continue;
    }
    if (reserved.has(account.realmsId)) counts[key]!.alreadyReserved++;
    else counts[key]![account.discord ? "discord" : "email"]++;
    if (account.ticket === "golden") counts[key]!.golden++;
  }
  console.log(
    JSON.stringify(
      {
        readAt: new Date().toISOString(),
        campaign: copy.campaign,
        awaySinceUtc: since === null ? null : new Date(since * 1000).toISOString(),
        confirmedBlock: season.confirmedBlock,
        historyBlock: season.activity.heldBlock,
        visitsRecordedSince: visitsSince === null ? null : new Date(visitsSince * 1000).toISOString(),
        figures: figures(season),
        recipients: counts,
        unresolved,
        optedOut,
      },
      null,
      1,
    ),
  );
}

/** Why a player who would get the email is left out: a recorded visit, a confirmed action alone, or no record yet. */
function leftOutBy(account: Account, at: number, visitsSince: number | null) {
  if (!isAway({ lastAction: 0, lastVisit: 0 }, at, visitsSince)) return "visitsUnknown" as const;
  return isAway({ ...account, lastAction: 0 }, at, visitsSince) ? ("actedOnly" as const) : ("visited" as const);
}

async function render(dir: string, copy: CopyFolder) {
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  checkCopy(copy, season);
  const optOut = await newsEmailOptOutLink(TARGETS.production.app, "render-only", "0x0");
  mkdirSync(dir, { recursive: true });
  for (const { key, golden } of copyFiles(copy)) {
    const reader = { to: "player@example.com", app: TARGETS.production.app, optOut, golden };
    const email = buildEmail(copy, key, season, reader, header);
    const name = `${dir}/${key}${golden ? ".golden" : ""}`;
    writeFileSync(`${name}.html`, email.html!.replace(`cid:${HEADER_ID}`, `data:image/jpeg;base64,${header}`));
    writeFileSync(`${name}.txt`, `Subject: ${email.subject}\n\n${email.text}\n`);
  }
  console.log(
    JSON.stringify({ figures: figures(season), headerKb: Math.round((header.length * 3) / 4 / 1024), wrote: dir }),
  );
}

/**
 * Each copy file once to one address, the subject marked "[TEST X]", with the stop link of the account that address
 * signs in to. Before each one it checks the account again, and nothing more goes once it has stopped news emails.
 * It logs counts, statuses and receipts only: never the account or its stop link, which can stop its emails.
 */
async function test(target: Target, to: string, copy: CopyFolder) {
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(to)) throw new Error("test needs one email address");
  const accountOf = () => d1(target, `SELECT realmsId, newsEmailOptOutAt FROM "user" WHERE email = '${to}'`)[0];
  const account = accountOf();
  if (!account) throw new Error("no account signs in with that address in this environment");
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  checkCopy(copy, season);
  const optOut = await optOutLinkOf(target, account.realmsId);
  for (const { key, golden } of copyFiles(copy)) {
    if (accountOf()?.newsEmailOptOutAt != null) {
      console.log(JSON.stringify({ variant: key, golden, sent: false, skipped: "opted_out" }));
      continue;
    }
    const reader = { to, app: target.app, optOut, golden };
    const label = `${key}${golden ? " golden" : ""}`;
    const email = buildEmail(copy, key, season, reader, header, `[TEST ${label}] `);
    const response = await sendEmail(resendKey(target), email);
    const quota = Object.fromEntries([...response.headers].filter(([name]) => /quota|ratelimit/i.test(name)));
    const body = (await response.json().catch(() => ({}))) as Row;
    console.log(
      JSON.stringify({
        variant: key,
        golden,
        status: response.status,
        id: body.id ?? null,
        sentAt: new Date().toISOString(),
        quota,
      }),
    );
    if (!response.ok) throw new Error(`Resend refused variant ${key}: ${response.status}`);
  }
  console.log(JSON.stringify({ figures: figures(season) }));
}

/**
 * The campaign to every account in the chosen variants that has not stopped news emails and has not had it yet. The
 * season is read once, so every email of a run says the same figures; each account is reserved in the send record,
 * with its opt-out checked again, before its email goes.
 */
async function send(target: Target, variants: readonly VariantKey[], withDiscord: boolean, copy: CopyFolder) {
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  checkCopy(copy, season);
  const visitsSince = visitsSinceOf(target);
  const deliveries = (readAccounts(target, season, true, visitsSince !== null) as Recipient[]).flatMap((account) => {
    const variant = variantOf(account, now(), visitsSince);
    return variant && variants.includes(variant) && (withDiscord || !account.discord) ? [{ ...account, variant }] : [];
  });
  const counts = await sendCampaign({
    deliveries,
    stillAway: async (delivery) => {
      await catchUpActivity(season);
      return stillFits(
        delivery.variant,
        {
          lastAction: season.activity.latestOf(delivery.addresses),
          lastVisit: visitRecord.seconds(d1(target, visitRecord.lastVisit(delivery.realmsId))[0]?.lastSeenAt),
        },
        now(),
        visitsSince,
      );
    },
    reserve: async (delivery) => reserveSend(target, copy.campaign, delivery),
    send: async (delivery): Promise<Handoff> => {
      const reader = {
        to: delivery.email,
        app: target.app,
        optOut: await optOutLinkOf(target, delivery.realmsId),
        golden: delivery.ticket === "golden",
      };
      const response = await sendEmail(
        resendKey(target),
        buildEmail(copy, delivery.variant, season, reader, header),
      ).catch(() => null);
      if (!response || response.status >= 500) return { kind: "unknown" };
      if (!response.ok) return { kind: "refused" };
      const body = (await response.json().catch(() => ({}))) as Row;
      return { kind: "accepted", id: typeof body.id === "string" ? body.id : null };
    },
    markSent: async (delivery, id) => void d1(target, sendRecord.markSent(copy.campaign, delivery, id, Date.now())),
    release: async (delivery) => void d1(target, sendRecord.release(copy.campaign, delivery)),
    pause: () => setTimeout(1000),
  });
  console.log(
    JSON.stringify({
      campaign: copy.campaign,
      variants,
      withDiscord,
      selected: deliveries.length,
      ...counts,
      figures: figures(season),
    }),
  );
  if (counts.refused || counts.unknown) process.exitCode = 1;
}

const optOutLinkOf = (target: Target, realmsId: string) =>
  newsEmailOptOutLink(target.app, privateFile<{ auth: string }>(target, "secrets.json").auth, realmsId);
const resendKey = (target: Target) => privateFile<{ resend: string }>(target, "inputs.json").resend;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueOf = (name: string) => (flag(name) ? args[args.indexOf(name) + 1] : undefined);
const target = flag("--env") ? TARGETS[valueOf("--env") as keyof typeof TARGETS] : TARGETS.production;
if (!target) throw new Error("--env is production or dev");
const copyDir = valueOf("--copy");
const copy = copyDir ? loadCopy(copyDir) : null;
const [mode, argument] = args;
if (copy && mode === "dry-run") await dryRun(target, copy);
else if (copy && mode === "render" && argument) await render(argument, copy);
else if (copy && mode === "test" && argument) await test(target, argument, copy);
else if (copy && mode === "send" && argument && /^[DNP](,[DNP])*$/.test(argument))
  await send(target, argument.split(",") as VariantKey[], flag("--discord"), copy);
else
  throw new Error(
    "usage: comeback-email.ts dry-run | render <dir> | test <address> | send <D,N,P> [--discord], each with --copy <dir> [--env dev]",
  );
