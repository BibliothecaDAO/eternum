// A news email's words, read from a copy folder outside the repo at run time, so they change without a merge. The script
// keeps who gets the email, the live figures, the layout and the send; the folder holds:
//   campaign          the send record's key: an account it reached never gets this campaign again
//   D.txt N.txt P.txt one per variant: header lines, a blank line, then paragraphs separated by blank lines
//   <V>.golden.txt    optional, used instead of <V>.txt for a reader whose ticket is golden
// A variant file:
//   Subject: {left} LORDS are still in the chests.
//   Preheader: the line inboxes show after the subject
//   Action: the button's words
//
//   **A bold paragraph.**
//   A paragraph with live figures: {players} players, {pool} LORDS.
//   {prizes}                    the prize board
//   > A gold callout.
//   {button}                    the one button, worded by Action:, to the app
//   [A link line](/profile)     a whole paragraph linking a path on the app
// Paragraphs after {button} are set smaller. Lines of one paragraph join with a space. Anything else in braces, a stray
// brace, other markup, a missing header or file, or an unknown file stops the run before any email goes.
import { readdirSync, readFileSync } from "node:fs";
import type { VariantKey } from "./comeback-campaign";

/** The live figures a copy file may name, each already worded (comeback-email.ts fills them). */
export const FIGURES = [
  "players",
  "pool",
  "won",
  "left",
  "usdLeft",
  "prize",
  "daysLeft",
  "endsAt",
  "claimLabor",
  "claimEssence",
  "goldenLabor",
  "goldenEssence",
  "goldenOneIn",
  "goldenLinkAt",
] as const;
export type Figures = Record<(typeof FIGURES)[number], string>;

export type Block =
  | { kind: "text"; text: string; style: "plain" | "bold" | "callout" }
  | { kind: "link"; text: string; path: string }
  | { kind: "prizes" }
  | { kind: "button" };

export interface Copy {
  subject: string;
  preheader: string;
  action: string;
  blocks: Block[];
}

/** One copy file as written, placeholders unfilled. */
interface Template extends Copy {
  file: string;
}

export interface CopyFolder {
  campaign: string;
  variants: Record<VariantKey, { regular: Template; golden: Template | null }>;
}

const VARIANT_KEYS = ["D", "N", "P"] as const satisfies readonly VariantKey[];
const HEADERS = ["Subject", "Preheader", "Action"] as const;
const PLACEHOLDER = /\{([A-Za-z]+)\}/g;

/** Reads and checks the whole folder; throws on the first problem, naming the file. */
export function loadCopy(dir: string): CopyFolder {
  const files = new Set(readdirSync(dir));
  const allowed = new Set(["campaign", ...VARIANT_KEYS.flatMap((key) => [`${key}.txt`, `${key}.golden.txt`])]);
  for (const file of files) if (!allowed.has(file)) throw new Error(`copy: unknown file ${file}`);
  if (!files.has("campaign")) throw new Error("copy: missing file campaign");
  const campaign = readFileSync(`${dir}/campaign`, "utf8").trim();
  if (!/^[a-z0-9-]+$/.test(campaign)) throw new Error("copy campaign: lowercase letters, digits and dashes only");
  const read = (file: string) => parseTemplate(file, readFileSync(`${dir}/${file}`, "utf8"));
  const variants = Object.fromEntries(
    VARIANT_KEYS.map((key) => {
      if (!files.has(`${key}.txt`)) throw new Error(`copy: missing file ${key}.txt`);
      const golden = files.has(`${key}.golden.txt`) ? read(`${key}.golden.txt`) : null;
      return [key, { regular: read(`${key}.txt`), golden }];
    }),
  ) as CopyFolder["variants"];
  return { campaign, variants };
}

/** Every copy file in the folder, with whether it is the golden reader's. */
export const copyFiles = (folder: CopyFolder) =>
  VARIANT_KEYS.flatMap((key) => {
    const { regular, golden } = folder.variants[key];
    return [{ key, golden: false, template: regular }, ...(golden ? [{ key, golden: true, template: golden }] : [])];
  });

/** The copy a reader gets: the golden file when their ticket is golden and the folder has one. */
export function copyFor(folder: CopyFolder, key: VariantKey, golden: boolean): Template {
  const { regular, golden: goldenCopy } = folder.variants[key];
  return golden && goldenCopy ? goldenCopy : regular;
}

/** The copy with every placeholder replaced by its live figure; a figure with no value stops the run. */
export function fillCopy(template: Template, figures: Figures): Copy {
  const fill = (text: string) =>
    text.replace(PLACEHOLDER, (_, name: string) => {
      const value = (figures as Record<string, string | undefined>)[name];
      if (value === undefined || value === "") throw new Error(`copy ${template.file}: {${name}} has no value`);
      return value;
    });
  return {
    subject: fill(template.subject),
    preheader: fill(template.preheader),
    action: fill(template.action),
    blocks: template.blocks.map((block) => ("text" in block ? { ...block, text: fill(block.text) } : block)),
  };
}

function parseTemplate(file: string, source: string): Template {
  const [head = "", ...paragraphs] = source
    .replaceAll("\r\n", "\n")
    .trim()
    .split(/\n\s*\n/);
  const headers = parseHeaders(file, head);
  const blocks = paragraphs.map((paragraph) => parseBlock(file, paragraph.split("\n").join(" ").trim()));
  const count = (kind: Block["kind"]) => blocks.filter((block) => block.kind === kind).length;
  if (count("button") !== 1) throw new Error(`copy ${file}: needs exactly one {button}`);
  if (count("prizes") > 1) throw new Error(`copy ${file}: at most one {prizes}`);
  for (const text of [headers.subject, headers.preheader, headers.action, ...blocks.flatMap(blockText)])
    checkPlaceholders(file, text);
  return { file, ...headers, blocks };
}

function parseHeaders(file: string, head: string) {
  const values = new Map<string, string>();
  for (const line of head.split("\n")) {
    const match = /^([A-Za-z]+):\s*(.*)$/.exec(line.trim());
    if (!match || !(HEADERS as readonly string[]).includes(match[1]!))
      throw new Error(`copy ${file}: the first lines are ${HEADERS.join(", ")} headers, then a blank line`);
    if (values.has(match[1]!)) throw new Error(`copy ${file}: ${match[1]} twice`);
    if (!match[2]) throw new Error(`copy ${file}: ${match[1]} is empty`);
    values.set(match[1]!, match[2]);
  }
  const header = (name: (typeof HEADERS)[number]) => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`copy ${file}: missing ${name} header`);
    return value;
  };
  return { subject: header("Subject"), preheader: header("Preheader"), action: header("Action") };
}

function parseBlock(file: string, paragraph: string): Block {
  if (paragraph === "{prizes}") return { kind: "prizes" };
  if (paragraph === "{button}") return { kind: "button" };
  const link = /^\[([^\]]+)\]\((\/[^\s()]*)\)$/.exec(paragraph);
  if (link) return { kind: "link", text: link[1]!, path: link[2]! };
  const bold = /^\*\*(.+)\*\*$/.exec(paragraph);
  const callout = /^> (.+)$/.exec(paragraph);
  const block: Block = bold
    ? { kind: "text", text: bold[1]!, style: "bold" }
    : callout
      ? { kind: "text", text: callout[1]!, style: "callout" }
      : { kind: "text", text: paragraph, style: "plain" };
  if (/\*\*|\]\(|^>/.test(block.text)) throw new Error(`copy ${file}: unsupported markup in "${block.text}"`);
  return block;
}

const blockText = (block: Block) => ("text" in block ? [block.text] : []);

function checkPlaceholders(file: string, text: string) {
  for (const [, name] of text.matchAll(PLACEHOLDER))
    if (!(FIGURES as readonly string[]).includes(name!)) throw new Error(`copy ${file}: unknown placeholder {${name}}`);
  if (/[{}]/.test(text.replace(PLACEHOLDER, ""))) throw new Error(`copy ${file}: stray brace in "${text}"`);
}
