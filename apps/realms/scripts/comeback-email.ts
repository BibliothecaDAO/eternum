// The Devcon Season 0 comeback email: one email in three variants, sent from the identity Worker's sender (Realms
// <no-reply@realms.party>, Resend, the production key in ~/.realms-production). Every number is read when it runs: the
// players, the chests won and the LORDS left from Herald, the LORDS price from CoinGecko, the ticket home's daily claim
// from the game's LaborRules row. No mode sends to a player; a player send waits for the owner's go.
//   bun apps/realms/scripts/comeback-email.ts dry-run          recipients per variant, counts only (read-only D1 + Herald)
//   bun apps/realms/scripts/comeback-email.ts render <dir>     each variant's HTML (header inlined) and text, for a look
//   bun apps/realms/scripts/comeback-email.ts test <address>   each variant once to that one address, "[TEST D]" etc.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { APP_ADDRESS, DOCS_ADDRESS } from "../../game/src/config/app-address";
import playtest from "../../game/src/shell/season-tab/archive/playtest.json";
import { campaignHomeClaim, type LaborRuleAmounts } from "../../../packages/core/src/utils/home-claim";
import { sendEmail, type Email } from "../../../packages/notifications/src/email";
import { BRAND, headingFontFile, paintingFile } from "../../../packages/notifications/scripts/email-art-inputs.mjs";
import { environments, root, type Inputs } from "../../../deploy/first/settings";
import { PrivateStore } from "../../../deploy/first/private-store";
import { Platform } from "../../../deploy/first/platform";

const HERALD = "https://herald.realms.party";
const GAME = 1;
const CAMPAIGN = "devcon-2026";
const PRIVATE = `${process.env.HOME}/.realms-production`;

type Row = Record<string, any>;
type VariantKey = "D" | "N" | "P";

// ---- What the email says, read live ---------------------------------------------------------------------------------

interface Season {
  players: number;
  pool: number;
  won: number;
  left: number;
  prize: number;
  usdLeft: number;
  endsAt: number;
  claim: { labor: number; essence: number };
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
    claim: campaignHomeClaim(model("LaborRules")[0] as LaborRuleAmounts, false),
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

interface Account {
  realmsId: string;
  discord: boolean;
  ticket: "regular" | "golden" | null;
  playtester: boolean;
  inSeason: boolean;
  lastAction: number;
}

/**
 * Each account in at most one variant, D before N before P:
 * - D: holds a Devcon ticket, founded in Season 0, no action yet today (UTC).
 * - N: holds a Devcon ticket, never founded.
 * - P: owns an address on the playtest's final board, holds no ticket, no Season 0 action yet today (UTC).
 * Only accounts whose email is verified; their addresses are never read by a dry run.
 */
function variantOf(account: Account, todayStart: number): VariantKey | null {
  if (account.ticket && account.inSeason) return account.lastAction < todayStart ? "D" : null;
  if (account.ticket) return "N";
  if (account.playtester && account.lastAction < todayStart) return "P";
  return null;
}

function readAccounts(season: Season): Account[] {
  const users = d1(
    `SELECT u.realmsId, EXISTS (SELECT 1 FROM account a WHERE a.userId = u.id AND a.providerId = 'discord') AS discord FROM "user" u WHERE u.emailVerified = 1 AND u.realmsId IS NOT NULL`,
  );
  const tickets = new Map(
    d1(`SELECT owner, tier FROM campaign_tickets WHERE campaign = '${CAMPAIGN}'`).map((row) => [row.owner, row.tier]),
  );
  const addresses = new Map<string, string[]>();
  for (const row of d1(`SELECT address, realmsId FROM realms_accounts`))
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
    };
  });
}

/** One read-only SELECT against production's identity D1, through wrangler with the deployer's Cloudflare token. */
function d1(query: string): Row[] {
  if (!/^select\b/i.test(query) || query.includes(";")) throw new Error("refused: not a single SELECT");
  const run = spawnSync(
    "pnpm",
    [
      "--dir",
      "apps/realms",
      "exec",
      "wrangler",
      "d1",
      "execute",
      "realms-identity-production",
      "--remote",
      "--env",
      "production",
      "--json",
      "--command",
      query,
    ],
    { cwd: root, env: cloudflare, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (run.status !== 0) throw new Error(`wrangler exit ${run.status}`);
  return JSON.parse(run.stdout)[0].results;
}

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
function paragraphs(variant: Variant, s: Season) {
  return {
    opening: variant.opening,
    fight: `${n(s.players)} players are fighting over ${n(s.pool)} LORDS in Frontier's Devcon season, and only ${n(s.won)} have been won so far.`,
    left: `That leaves about ${about(s.left)} LORDS (around ${dollars(s.usdLeft)}) sitting in chests in the ruins. Another ${n(s.prize)} go to the top three when the season ends.`,
    claim: variant.claims
      ? `Your Devcon realm pays ${n(s.claim.labor)} Labor and ${n(s.claim.essence)} Essence every game day. Miss a day and it's gone.`
      : undefined,
    ends: endsLine(s),
  };
}

const PREHEADER = (s: Season) => `${n(s.players)} players are in Frontier's Devcon season. Your realm is waiting.`;
const HEADER_ID = "header";

function buildEmail(key: VariantKey, s: Season, to: string, header: Buffer, subjectPrefix = ""): Email {
  const variant = VARIANTS[key];
  const words = paragraphs(variant, s);
  const docsUrl = `${DOCS_ADDRESS}${variant.docs.path}`;
  const subject = `${subjectPrefix}${variant.subject(s)}`;
  const text = [
    words.opening,
    words.fight,
    words.left,
    words.claim,
    words.ends,
    `${variant.action}: ${APP_ADDRESS}`,
    `${variant.docs.label}: ${docsUrl}`,
    `Realms · Frontier · Devcon Season 0\nSent to ${to}, the email of your Realms account. Privacy: ${APP_ADDRESS}/privacy`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    sender: "Realms",
    to,
    subject,
    text,
    html: emailHtml({ subject, preheader: PREHEADER(s), words, variant, docsUrl, to, s }),
    images: [{ id: HEADER_ID, filename: "devcon-season-0.jpg", content: header.toString("base64") }],
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
  to: string;
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
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${GOLD};border-radius:8px"><a href="${escape(APP_ADDRESS)}" style="display:inline-block;padding:15px 30px;font-family:${BODY};font-size:17px;font-weight:700;color:${INK};text-decoration:none">${escape(e.variant.action)} &rarr;</a></td></tr></table>`,
    ),
    row(
      "16px 40px 0",
      `<a href="${escape(e.docsUrl)}" style="font-family:${BODY};font-size:15px;line-height:22px;color:${GOLD};text-decoration:underline">${escape(e.variant.docs.label)}</a><span style="font-family:${BODY};font-size:15px;color:${MUTED}"> · Frontier guide</span>`,
    ),
    row("32px 40px 0", `<div style="height:1px;line-height:1px;font-size:0;background:${LINE}">&nbsp;</div>`),
    row(
      "18px 40px 36px",
      `<a href="${escape(APP_ADDRESS)}" style="color:${GOLD};text-decoration:none;font-weight:700">Realms</a> · Frontier · <span style="color:${VIOLET}">Devcon Season 0</span><br>Sent to ${escape(e.to)}, the email of your Realms account. <a href="${escape(APP_ADDRESS)}/privacy" style="color:${MUTED}">Privacy</a>`,
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
const HEIGHT = 640;

async function drawHeader(): Promise<Buffer> {
  const painting = await sharp(await readFile(paintingFile("frontier-mist")))
    .resize({ width: WIDTH })
    .toBuffer({ resolveWithObject: true });
  const crop = await sharp(painting.data)
    .extract({ left: 0, top: Math.round((painting.info.height - HEIGHT) * 0.45), width: WIDTH, height: HEIGHT })
    .toBuffer();
  const lockup = await sharp(
    await readFile(new URL(BRAND.marks.lockups.frontier.slice(1), new URL("../../game/public/", import.meta.url))),
  )
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
    .toBuffer();
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
      fontfile: headingFontFile().pathname,
      dpi: 96,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

// ---- Modes ----------------------------------------------------------------------------------------------------------

const store = new PrivateStore(PRIVATE, root, false);
const inputs = store.read<Inputs>("inputs.json")!;
const cloudflare = {
  ...process.env,
  ...(await new Platform(environments.production, inputs, store, false).cloudflareEnvironment()),
};

function figures(s: Season) {
  return {
    players: s.players,
    pool: s.pool,
    won: s.won,
    left: s.left,
    prize: s.prize,
    usdLeft: Math.round(s.usdLeft),
    endsAt: new Date(s.endsAt * 1000).toISOString(),
    claim: s.claim,
  };
}

async function dryRun() {
  const season = await readSeason();
  const todayStart = Math.floor(Date.now() / 86_400_000) * 86_400;
  const counts = {
    D: { email: 0, discord: 0, golden: 0 },
    N: { email: 0, discord: 0, golden: 0 },
    P: { email: 0, discord: 0, golden: 0 },
  };
  for (const account of readAccounts(season)) {
    const key = variantOf(account, todayStart);
    if (!key) continue;
    counts[key][account.discord ? "discord" : "email"]++;
    if (account.ticket === "golden") counts[key].golden++;
  }
  console.log(
    JSON.stringify(
      {
        readAt: new Date().toISOString(),
        todayStartUtc: new Date(todayStart * 1000).toISOString(),
        figures: figures(season),
        recipients: counts,
      },
      null,
      1,
    ),
  );
}

async function render(dir: string) {
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  mkdirSync(dir, { recursive: true });
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    const email = buildEmail(key, season, "player@example.com", header);
    writeFileSync(
      `${dir}/${key}.html`,
      email.html!.replace(`cid:${HEADER_ID}`, `data:image/jpeg;base64,${header.toString("base64")}`),
    );
    writeFileSync(`${dir}/${key}.txt`, `Subject: ${email.subject}\n\n${email.text}\n`);
  }
  console.log(JSON.stringify({ figures: figures(season), headerKb: Math.round(header.length / 1024), wrote: dir }));
}

/** Each variant once to one address, the subject marked "[TEST X]"; Resend's quota headers say what today used. */
async function test(to: string) {
  if (!/^[^\s@]+@[^\s@]+$/.test(to)) throw new Error("test needs one email address");
  const [season, header] = await Promise.all([readSeason(), drawHeader()]);
  for (const key of Object.keys(VARIANTS) as VariantKey[]) {
    const response = await sendEmail(inputs.resend, buildEmail(key, season, to, header, `[TEST ${key}] `));
    const quota = Object.fromEntries([...response.headers].filter(([name]) => /quota|ratelimit/i.test(name)));
    const body = (await response.json()) as Row;
    console.log(
      JSON.stringify({
        variant: key,
        status: response.status,
        id: body.id ?? null,
        sentAt: new Date().toISOString(),
        quota,
      }),
    );
    if (!response.ok) throw new Error(`Resend refused variant ${key}: ${response.status} ${body.name ?? ""}`);
  }
  console.log(JSON.stringify({ figures: figures(season) }));
}

const [mode, argument] = process.argv.slice(2);
if (mode === "dry-run") await dryRun();
else if (mode === "render" && argument) await render(argument);
else if (mode === "test" && argument) await test(argument);
else throw new Error("usage: comeback-email.ts dry-run | render <dir> | test <address>");
