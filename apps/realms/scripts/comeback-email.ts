// The Devcon Season 0 comeback email: one email in three variants, sent from the identity Worker's sender (Realms
// <no-reply@realms.party>, Resend). Every number is read when it runs: the players, the chests won and the LORDS left
// from Herald, the LORDS price from CoinGecko, a ticket home's daily claim from the game's LaborRules row. Each email
// carries its account's stop link (server/news-email-opt-out.ts) as a footer link and as List-Unsubscribe headers.
//   pnpm --dir apps/realms comeback-email dry-run [--env dev]        recipients per variant, counts only (read-only)
//   pnpm --dir apps/realms comeback-email render <dir>               each variant's HTML (header inlined) and text
//   pnpm --dir apps/realms comeback-email test <address> [--env dev] each variant once to that address's account
//   pnpm --dir apps/realms comeback-email send <D,N,P> [--discord]   the campaign, after the owner's go
// The environment's Resend key, auth secret and Cloudflare token come from its private directory and are never printed;
// no player's email address is printed either.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import sharp from "sharp";
import { campaignHomeClaim, type LaborRuleAmounts } from "@bibliothecadao/eternum";
import environments from "../../../deploy/first/environments.json";
import playtest from "../../../packages/core/src/sync/season-archives/playtest.json";
import { sendEmail, type Email } from "../../../packages/notifications/src/email";
import BRAND from "../../../packages/notifications/src/brand.gen.json";
import { newsEmailOptOutLink } from "../server/news-email-opt-out";
import {
  sendCampaign,
  sendRecord,
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
/** This email's key in the send record (news_email_sends): an account it reached is never sent it again. */
const NEWS_CAMPAIGN = "devcon-s0-comeback";

/**
 * Where each environment's accounts live, and its app and docs origins as the deployer publishes them
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
  return { app: environment.origin, docs: environment.docs.origin, wranglerEnv: environment.worker };
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
  lastAction: Map<string, number>;
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
  const lastAction = new Map<string, number>();
  for (const event of history) {
    const owner = event.value?.owner;
    if (!owner) continue;
    const at = Number(BigInt(event.value.timestamp));
    lastAction.set(norm(owner), Math.max(lastAction.get(norm(owner)) ?? 0, at));
  }
  return {
    players: Number(game.player_count),
    pool: Number(BigInt(budget.pool)) + prize,
    won: (board.entries as Row[]).reduce((sum, entry) => sum + Number(entry.rewards?.lords ?? 0), 0),
    left,
    prize,
    usdLeft: left * price,
    endsAt: Number(game.clock.end_at),
    rules: model("LaborRules")[0] as LaborRuleAmounts,
    lastAction,
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

async function readLordsPrice(): Promise<number> {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=lords&vs_currencies=usd");
  if (!response.ok) throw new Error(`CoinGecko: ${response.status}`);
  const usd = ((await response.json()) as Row).lords?.usd;
  if (typeof usd !== "number" || !(usd > 0)) throw new Error("CoinGecko: no LORDS price");
  return usd;
}

// ---- Who gets which variant (counts only leave this file) -----------------------------------------------------------

/** A campaign account with its email address, read only by a send. */
type Recipient = Account & { email: string };

/** Every account with a verified email, as comeback-campaign.ts decides on them; addresses only when asked for. */
function readAccounts(target: Target, season: Season, withEmail: boolean): (Account & { email?: string })[] {
  const users = d1(
    target,
    `SELECT u.realmsId, u.newsEmailOptOutAt, ${withEmail ? "u.email, " : ""}EXISTS (SELECT 1 FROM account a WHERE a.userId = u.id AND a.providerId = 'discord') AS discord FROM "user" u WHERE u.emailVerified = 1 AND u.realmsId IS NOT NULL`,
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
      lastAction: Math.max(0, ...owned.map((address) => season.lastAction.get(address) ?? 0)),
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
function reserveSend(target: Target, delivery: Delivery): Reservation {
  if (d1(target, sendRecord.reserve(NEWS_CAMPAIGN, delivery, Date.now())).length) return "reserved";
  return d1(target, sendRecord.optedOut(delivery))[0]?.newsEmailOptOutAt != null ? "opted_out" : "taken";
}

const privateFile = <T>(target: Target, name: string): T =>
  JSON.parse(readFileSync(`${process.env.HOME}/${target.store}/${name}`, "utf8")) as T;

// ---- The email ------------------------------------------------------------------------------------------------------

interface Variant {
  subject: (season: Season) => string;
  /** The variant's own first line, before the shared body. */
  opening?: string;
  /** Whether the reader's Devcon ticket home claims each day (a playtester holds no ticket). */
  claims: boolean;
  action: string;
  docs: { label: string; path: string };
}

const CHESTS_DOCS = { label: "How ruins and chests pay LORDS", path: "/frontier/chests/" };

const VARIANTS: Record<VariantKey, Variant> = {
  D: {
    subject: (s) => `${about(s.left)} LORDS are still in the chests. ${daysLeft(s)}.`,
    claims: true,
    action: "Back to your realm",
    docs: CHESTS_DOCS,
  },
  N: {
    subject: (s) => `Your Devcon realm isn't founded yet. ${about(s.left)} LORDS are.`,
    opening: "You made a Realms account at Devcon but haven't founded your realm. It takes one tap.",
    claims: true,
    action: "Found your realm",
    docs: { label: "How your Devcon ticket works", path: "/frontier/devcon/" },
  },
  P: {
    subject: (s) => `${n(s.players)} players, ${n(s.pool)} LORDS, ${daysLeft(s).toLowerCase()}`,
    opening: "You played the Frontier playtest. Season 0 is live with Devcon players from around the world.",
    claims: false,
    action: "Back to Frontier",
    docs: CHESTS_DOCS,
  },
};

const n = (value: number) => Math.round(value).toLocaleString("en-US");
/** LORDS left, rounded down to the thousand so "about" never overstates. */
const about = (lords: number) => n(Math.floor(lords / 1000) * 1000);
/** A dollar figure to two significant digits: "around $1,000". */
const dollars = (usd: number) => `$${n(Number(usd.toPrecision(2)))}`;
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
const daysLeft = (s: Season) => {
  const days = Math.floor((s.endsAt - Date.now() / 1000) / 86400);
  return days <= 0 ? "Last day" : `${WORDS[days] ?? n(days)} day${days === 1 ? "" : "s"} left`;
};
const endsLine = (s: Season) => {
  const end = new Date(s.endsAt * 1000);
  const day = end.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const time = end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `Season 0 ends ${day} at ${time} UTC.`;
};

/** The words, in order, that both the HTML and the text part say. */
function paragraphs(variant: Variant, s: Season, golden: boolean) {
  const claim = campaignHomeClaim(s.rules, golden);
  return {
    opening: variant.opening,
    fight: `${n(s.players)} players are fighting over ${n(s.pool)} LORDS in Frontier's Devcon season, and only ${n(s.won)} have been won so far.`,
    left: `That leaves about ${about(s.left)} LORDS (around ${dollars(s.usdLeft)}) sitting in chests in the ruins. Another ${n(s.prize)} go to the top three when the season ends.`,
    claim: variant.claims
      ? `Your Devcon realm pays ${n(claim.labor)} Labor and ${n(claim.essence)} Essence every game day. Miss a day and it's gone.`
      : undefined,
    ends: endsLine(s),
  };
}

const PREHEADER = (s: Season) => `${n(s.players)} players are in Frontier's Devcon season. Your realm is waiting.`;
const HEADER_ID = "header";

/** Who one email is for: their address, their app, their stop link, and whether their ticket is golden. */
interface Reader {
  to: string;
  app: string;
  docs: string;
  optOut: string;
  golden: boolean;
}

function buildEmail(key: VariantKey, s: Season, reader: Reader, header: string, subjectPrefix = ""): Email {
  const variant = VARIANTS[key];
  const words = paragraphs(variant, s, reader.golden);
  const docsUrl = `${reader.docs}${variant.docs.path}`;
  const subject = `${subjectPrefix}${variant.subject(s)}`;
  const text = [
    words.opening,
    words.fight,
    words.left,
    words.claim,
    words.ends,
    `${variant.action}: ${reader.app}`,
    `${variant.docs.label}: ${docsUrl}`,
    `Realms · Frontier · Devcon Season 0\nSent to ${reader.to}, the email of your Realms account.\nStop these emails: ${reader.optOut}\nPrivacy: ${reader.app}/privacy`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    sender: "Realms",
    to: reader.to,
    subject,
    text,
    html: emailHtml({ subject, preheader: PREHEADER(s), words, variant, docsUrl, reader, s }),
    images: [{ id: HEADER_ID, filename: "devcon-season-0.jpg", content: header }],
    headers: { "List-Unsubscribe": `<${reader.optOut}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
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
const reading = `font-family:${BODY};font-size:17px;line-height:26px;color:${CREAM}`;

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

function emailHtml(e: {
  subject: string;
  preheader: string;
  words: ReturnType<typeof paragraphs>;
  variant: Variant;
  docsUrl: string;
  reader: Reader;
  s: Season;
}) {
  const rows = [
    `<tr><td style="padding:0;line-height:0;font-size:0"><img src="cid:${HEADER_ID}" width="600" alt="Realms · Frontier · Devcon Season 0" style="width:100%;max-width:600px;height:auto;display:block;border-radius:12px 12px 0 0"></td></tr>`,
    ...(e.words.opening ? [row("28px 40px 0", escape(e.words.opening), `${reading};font-weight:700`)] : []),
    row(`${e.words.opening ? 16 : 28}px 40px 0`, escape(e.words.fight), reading),
    row("20px 34px 0", prizeBoard(e.s)),
    row("20px 40px 0", escape(e.words.left), reading),
    ...(e.words.claim ? [row("16px 40px 0", escape(e.words.claim), reading)] : []),
    row("16px 40px 0", escape(e.words.ends), `${reading};color:${GOLD2};font-weight:700`),
    row(
      "28px 40px 0",
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${GOLD};border-radius:8px"><a href="${escape(e.reader.app)}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:17px;font-weight:700;color:${INK};text-decoration:none">${escape(e.variant.action)} &rarr;</a></td></tr></table>`,
    ),
    row(
      "16px 40px 0",
      `<a href="${escape(e.docsUrl)}" style="font-family:${BODY};font-size:15px;line-height:22px;color:${GOLD};text-decoration:underline">${escape(e.variant.docs.label)}</a><span style="font-family:${BODY};font-size:15px;color:${MUTED}"> · Frontier guide</span>`,
    ),
    row("32px 40px 0", `<div style="height:1px;line-height:1px;font-size:0;background:${LINE}">&nbsp;</div>`),
    row(
      "18px 40px 36px",
      `<a href="${escape(e.reader.app)}" style="color:${GOLD};text-decoration:none;font-weight:700">Realms</a> · Frontier · <span style="color:${VIOLET}">Devcon Season 0</span><br>Sent to ${escape(e.reader.to)}, the email of your Realms account.<br><a href="${escape(e.reader.optOut)}" style="color:${MUTED}">Stop these emails</a> · <a href="${escape(e.reader.app)}/privacy" style="color:${MUTED}">Privacy</a>`,
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
<title>${escape(e.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%} table{border-collapse:collapse} img{border:0;outline:none;text-decoration:none}
@media (max-width:620px){ .px{padding-left:20px !important;padding-right:20px !important} .figure{font-size:26px !important;line-height:32px !important} .stat{padding:12px 6px !important} }
</style>
</head>
<body style="margin:0;padding:0;background:${NIGHT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(e.preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
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

const todayStart = () => Math.floor(Date.now() / 86_400_000) * 86_400;

async function dryRun(target: Target) {
  const season = await readSeason();
  const record = d1(target, `SELECT realmsId, status FROM news_email_sends WHERE campaign = '${NEWS_CAMPAIGN}'`);
  const reserved = new Set(record.map((row) => row.realmsId));
  /** Reserved by a run that never marked them sent: check them against Resend's log before anything else. */
  const unresolved = record.filter((row) => row.status === "reserved").length;
  const counts = Object.fromEntries(
    (["D", "N", "P"] as const).map((key) => [key, { email: 0, discord: 0, golden: 0, alreadyReserved: 0 }]),
  );
  let optedOut = 0;
  for (const account of readAccounts(target, season, false)) {
    if (account.optedOut) optedOut++;
    const key = variantOf(account, todayStart());
    if (!key) continue;
    if (reserved.has(account.realmsId)) counts[key]!.alreadyReserved++;
    else counts[key]![account.discord ? "discord" : "email"]++;
    if (account.ticket === "golden") counts[key]!.golden++;
  }
  console.log(
    JSON.stringify(
      {
        readAt: new Date().toISOString(),
        todayStartUtc: new Date(todayStart() * 1000).toISOString(),
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

async function render(dir: string) {
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  const reader = {
    to: "player@example.com",
    app: TARGETS.production.app,
    docs: TARGETS.production.docs,
    optOut: await newsEmailOptOutLink(TARGETS.production.app, "render-only", "0x0"),
    golden: false,
  };
  mkdirSync(dir, { recursive: true });
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    const email = buildEmail(key, season, reader, header);
    writeFileSync(`${dir}/${key}.html`, email.html!.replace(`cid:${HEADER_ID}`, `data:image/jpeg;base64,${header}`));
    writeFileSync(`${dir}/${key}.txt`, `Subject: ${email.subject}\n\n${email.text}\n`);
  }
  console.log(
    JSON.stringify({ figures: figures(season), headerKb: Math.round((header.length * 3) / 4 / 1024), wrote: dir }),
  );
}

/**
 * Each variant once to one address, the subject marked "[TEST X]", with the stop link of the account that address
 * signs in to. Before each one it checks the account again, and nothing more goes once it has stopped news emails.
 * It logs counts, statuses and receipts only: never the account or its stop link, which can stop its emails.
 */
async function test(target: Target, to: string) {
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(to)) throw new Error("test needs one email address");
  const accountOf = () => d1(target, `SELECT realmsId, newsEmailOptOutAt FROM "user" WHERE email = '${to}'`)[0];
  const account = accountOf();
  if (!account) throw new Error("no account signs in with that address in this environment");
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  const reader = {
    to,
    app: target.app,
    docs: target.docs,
    optOut: await optOutLinkOf(target, account.realmsId),
    golden: false,
  };
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    if (accountOf()?.newsEmailOptOutAt != null) {
      console.log(JSON.stringify({ variant: key, sent: false, skipped: "opted_out" }));
      continue;
    }
    const response = await sendEmail(resendKey(target), buildEmail(key, season, reader, header, `[TEST ${key}] `));
    const quota = Object.fromEntries([...response.headers].filter(([name]) => /quota|ratelimit/i.test(name)));
    const body = (await response.json().catch(() => ({}))) as Row;
    console.log(
      JSON.stringify({
        variant: key,
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
async function send(target: Target, variants: readonly VariantKey[], withDiscord: boolean) {
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  const today = todayStart();
  const deliveries = (readAccounts(target, season, true) as Recipient[]).flatMap((account) => {
    const variant = variantOf(account, today);
    return variant && variants.includes(variant) && (withDiscord || !account.discord) ? [{ ...account, variant }] : [];
  });
  const counts = await sendCampaign({
    deliveries,
    reserve: async (delivery) => reserveSend(target, delivery),
    send: async (delivery): Promise<Handoff> => {
      const reader = {
        to: delivery.email,
        app: target.app,
        docs: target.docs,
        optOut: await optOutLinkOf(target, delivery.realmsId),
        golden: delivery.ticket === "golden",
      };
      const response = await sendEmail(resendKey(target), buildEmail(delivery.variant, season, reader, header)).catch(
        () => null,
      );
      if (!response || response.status >= 500) return { kind: "unknown" };
      if (!response.ok) return { kind: "refused" };
      const body = (await response.json().catch(() => ({}))) as Row;
      return { kind: "accepted", id: typeof body.id === "string" ? body.id : null };
    },
    markSent: async (delivery, id) => void d1(target, sendRecord.markSent(NEWS_CAMPAIGN, delivery, id, Date.now())),
    release: async (delivery) => void d1(target, sendRecord.release(NEWS_CAMPAIGN, delivery)),
    pause: () => setTimeout(1000),
  });
  console.log(
    JSON.stringify({
      campaign: NEWS_CAMPAIGN,
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
const envName = args[args.indexOf("--env") + 1];
const target = flag("--env") ? TARGETS[envName as keyof typeof TARGETS] : TARGETS.production;
if (!target) throw new Error("--env is production or dev");
const [mode, argument] = args;
if (mode === "dry-run") await dryRun(target);
else if (mode === "render" && argument) await render(argument);
else if (mode === "test" && argument) await test(target, argument);
else if (mode === "send" && argument && /^[DNP](,[DNP])*$/.test(argument))
  await send(target, argument.split(",") as VariantKey[], flag("--discord"));
else
  throw new Error(
    "usage: comeback-email.ts dry-run | render <dir> | test <address> | send <D,N,P> [--discord] [--env dev]",
  );
