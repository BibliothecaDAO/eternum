// The words inventory: every place outside the words module (src/ui/design-system/kit: words.ts, amount.ts, time.ts,
// voice.ts; and src/three/map-plates/site-name.ts) that writes a number or a time, names a thing, or shows a player a string that breaks a voice
// rule. Read from the TypeScript syntax of the client and core. Left out: tests, labs, debug tools, and the renderer's
// own measuring (diagnostics, benchmarks, traces, instrumentation), which no player reads; a number rounded for
// arithmetic (Number(x.toFixed(2))) and anything written to the console are not formatting.
//   node scripts/words-inventory.mjs [--json <file>]      prints the counts as markdown; --json keeps every hit
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const GAME = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(GAME, "../..");
const ROOTS = { client: join(GAME, "src"), core: join(REPO, "packages/core/src") };
const KIT = "src/ui/design-system/kit/";
const WORDS_MODULE = [
  ...["words.ts", "amount.ts", "time.ts", "voice.ts"].map((file) => KIT + file),
  "src/three/map-plates/site-name.ts",
];
const LEFT_OUT =
  /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$|\/(debug|lab|__fixtures__|gym|benchmark|perf)\/|diagnostics|instrumentation|monitoring|flight-trace|stats-recorder|fixture/;

const CATEGORIES = {
  "number.locale": "toLocaleString (a number, or a date, in the device's language)",
  "number.fixed": "toFixed / toPrecision",
  "number.intl": "Intl.NumberFormat",
  "number.suffix": "a K/M/B suffix built by hand",
  "time.intl": "Intl.DateTimeFormat / RelativeTimeFormat",
  "time.locale": "toLocaleTimeString / toLocaleDateString",
  "time.units": "a duration built by hand (`${h}h ${m}m`, minutes, seconds)",
  "time.ago": 'an "ago" built by hand',
  "name.enumKey": "an enum key read as a name (ResourcesIds[id], StructureType[type])",
  "name.trait": "a resource named by its table's .trait",
  "name.table": "a noun table read directly (RealmLevelNames, getLevelName, GUARD_SLOT_NAMES…)",
  "name.entity": "an entity named through core (getEntityName, getStructureName…)",
  "name.literal": "a game noun spelled by hand",
  formatter: "a local formatter: a named function that does any of the number or time work above",
};

const NAME_ENUMS = new Set(["ResourcesIds", "StructureType", "RealmLevels", "BuildingType", "GuardSlot", "TroopTier"]);
const NOUN_TABLES = new Set([
  "RealmLevelNames",
  "getLevelName",
  "StructureTypeToNameMapping",
  "getStructureTypeName",
  "MineKinds",
  "getMinePresentation",
  "GUARD_SLOT_NAMES",
]);
const ENTITY_NAMERS = new Set([
  "getEntityName",
  "getStructureName",
  "getArmyName",
  "getRealmNameById",
  "getHyperstructureName",
  "getAddressName",
]);
// A string a player cannot read: an attribute or a call that takes code, not words.
const CODE_ATTRIBUTES = /^(className|class|style|key|id|type|href|src|to|role|name|data-[\w-]+|htmlFor|target|rel)$/;
const CODE_CALLS =
  /^(cn|clsx|classNames|twMerge|cva|require|import|querySelector\w*|getElementById|addEventListener|console\.\w+)$/;
const UNIT = /^(?:h|m|s|d|min|mins|sec|secs|hr|hrs)(?![A-Za-z])|^ (?:hours?|minutes?|seconds?|days?)\b/;
const TIME_HINT = /Math\.(?:floor|ceil|round)|%|\/\s*60|3600|86_?400|hours?|minutes?|mins?|seconds?|secs?|days?/i;
const SUFFIX = /^[KMB](?![A-Za-z])/;
// A token, a path or a key ("left-queue", "/images/x.png", "army_banner"): code, whatever it spells.
const CODE_TOKEN = /^[\w.$-]*[-_./:][\w.$/:-]*$/;
// An SVG path's commands between its numbers: "M ", " L ", " C ".
const SVG_PATH = /^[\sMLCQSTAZHV,.\d-]*$/i;
const AMOUNT_HINT = /\/\s*1_?000|1e[369]|toFixed|compact|thousand|million/i;

const nounsOf = async () => {
  const types = await import("@bibliothecadao/types");
  return new Set([
    ...types.resources.map((resource) => resource.trait).filter((trait) => /^[A-Z][A-Za-z ]+$/.test(trait)),
    ...Object.values(types.StructureTypeToNameMapping),
    ...Object.values(types.MineKinds).map((kind) => kind.name),
    ...Object.values(types.RealmLevelNames),
    ...Object.values(types.GUARD_SLOT_NAMES),
    "Crossbowman",
    "Blitz",
    "Frontier",
    "Eternum",
  ]);
};

/** The voice rules, read from voice.ts itself: the module that states them is the one the inventory checks. */
const voiceRulesOf = async () => {
  const source = readFileSync(join(GAME, KIT, "voice.ts"), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const { VOICE_RULES } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
  return VOICE_RULES.filter((rule) => rule.forbidden);
};

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") yield* sourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
  }
}

const calleeName = (call) => {
  const expression = call.expression;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    const owner = ts.isIdentifier(expression.expression) ? `${expression.expression.text}.` : "";
    return `${owner}${expression.name.text}`;
  }
  return "";
};

/** Whether a string literal is code (an import, a class name, a key) rather than words a player reads. */
const isCodeString = (node) => {
  const parent = node.parent;
  if (!parent) return true;
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CODE_TOKEN.test(node.text)) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent))
    return true;
  if (ts.isLiteralTypeNode(parent) || (ts.isPropertyAssignment(parent) && parent.name === node)) return true;
  if (ts.isElementAccessExpression(parent) || ts.isCaseClause(parent)) return true;
  if (ts.isBinaryExpression(parent) && /=== |!== |== |!= /.test(` ${parent.operatorToken.getText()} `)) return true;
  if (ts.isJsxAttribute(parent) || (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent))) {
    const attribute = ts.isJsxAttribute(parent) ? parent : parent.parent;
    return CODE_ATTRIBUTES.test(attribute.name.getText());
  }
  for (let up = parent; up; up = up.parent) {
    if (ts.isCallExpression(up) && CODE_CALLS.test(calleeName(up))) return true;
    if (ts.isJsxAttribute(up)) return CODE_ATTRIBUTES.test(up.name.getText());
    if (ts.isBlock(up) || ts.isSourceFile(up)) break;
  }
  return false;
};

const inConsole = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isCallExpression(up) && /^console\./.test(calleeName(up))) return true;
  }
  return false;
};

/** A number written into an SVG path ("M 12.5 40.0 C …"): a coordinate, not a figure a player reads. */
const inSvgPath = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isTemplateExpression(up)) {
      const pieces = [up.head.text, ...up.templateSpans.map((span) => span.literal.text)];
      return pieces.every((piece) => SVG_PATH.test(piece)) && pieces.some((piece) => /[MLCQ]/i.test(piece));
    }
  }
  return false;
};

/** Number(x.toFixed(2)), parseFloat(…), +x.toFixed(2): a number rounded to compute with, not written for a player. */
const roundsForArithmetic = (call) => {
  const parent = call.parent;
  if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.PlusToken) return true;
  return ts.isCallExpression(parent) && /^(Number|parseFloat|Number\.parseFloat)$/.test(calleeName(parent));
};

/** A template's text as a player reads it, each substitution standing in as a number. */
const templateText = (node) => node.head.text + node.templateSpans.map((span) => `7${span.literal.text}`).join("");

/** Every hit in one file's source: { category, line, text }. */
export function scanSource(source, fileName, { nouns, voiceRules }) {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith("x") ? 4 : 3);
  const hits = [];
  const hit = (category, node, text = node.getText(file)) =>
    hits.push({
      category,
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      text: text.slice(0, 120),
    });
  const numberOrTime = (node) => {
    if (inConsole(node)) return null;
    if (ts.isCallExpression(node)) {
      const name = calleeName(node).replace(/^.*\./, "");
      if (name === "toLocaleString") return "number.locale";
      if ((name === "toFixed" || name === "toPrecision") && !roundsForArithmetic(node) && !inSvgPath(node)) {
        return "number.fixed";
      }
      if (name === "toLocaleTimeString" || name === "toLocaleDateString") return "time.locale";
    }
    if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && ts.isPropertyAccessExpression(node.expression)) {
      const target = node.expression.getText(file);
      if (target === "Intl.NumberFormat") return "number.intl";
      if (target === "Intl.DateTimeFormat" || target === "Intl.RelativeTimeFormat") return "time.intl";
    }
    if (ts.isTemplateExpression(node)) {
      for (const span of node.templateSpans) {
        const expression = span.expression.getText(file);
        if (UNIT.test(span.literal.text) && TIME_HINT.test(expression)) return "time.units";
        if (SUFFIX.test(span.literal.text) && AMOUNT_HINT.test(expression)) return "number.suffix";
      }
      if (/\bago\b/.test(templateText(node))) return "time.ago";
    }
    return null;
  };
  const visible = (node, text) => {
    for (const rule of voiceRules) if (rule.forbidden.test(text)) hit(`voice: ${rule.rule}`, node, text);
  };
  const visit = (node) => {
    const work = numberOrTime(node);
    if (work) hit(work, node);
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      NAME_ENUMS.has(node.expression.text)
    ) {
      const isWrite = ts.isBinaryExpression(node.parent) && node.parent.left === node;
      if (!isWrite && !ts.isStringLiteral(node.argumentExpression)) hit("name.enumKey", node);
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "trait") hit("name.trait", node);
    if (ts.isIdentifier(node) && NOUN_TABLES.has(node.text) && !ts.isImportSpecifier(node.parent))
      hit("name.table", node);
    if (ts.isCallExpression(node) && ENTITY_NAMERS.has(calleeName(node).replace(/^.*\./, ""))) hit("name.entity", node);
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isCodeString(node)) {
      if (nouns.has(node.text)) hit("name.literal", node, node.text);
      visible(node, node.text);
    }
    if (ts.isTemplateExpression(node) && !isCodeString(node)) visible(node, templateText(node));
    if (ts.isJsxText(node) && node.text.trim()) {
      const text = node.text.trim();
      if (nouns.has(text)) hit("name.literal", node, text);
      visible(node, text);
    }
    if (isNamedFunction(node)) {
      let works = false;
      const inside = (child) => {
        if (works) return;
        if (numberOrTime(child)?.match(/^(number|time)\./)) works = true;
        else ts.forEachChild(child, inside);
      };
      ts.forEachChild(node, inside);
      if (works) hit("formatter", node, namedFunction(node));
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}

/** A function with a name that is not a component (a component's name is capitalised): a helper that writes text. */
const isNamedFunction = (node) => !/^[A-Z]/.test(namedFunction(node) ?? "A");
const namedFunction = (node) =>
  (ts.isFunctionDeclaration(node) && node.name?.text) ||
  (ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
    node.name.text) ||
  undefined;

async function inventory() {
  const context = { nouns: await nounsOf(), voiceRules: await voiceRulesOf() };
  const hits = [];
  for (const [root, dir] of Object.entries(ROOTS)) {
    for (const path of sourceFiles(dir)) {
      const file = relative(root === "client" ? GAME : join(REPO, "packages/core"), path);
      if (LEFT_OUT.test(`/${file}`) || WORDS_MODULE.includes(file)) continue;
      for (const each of scanSource(readFileSync(path, "utf8"), path, context)) hits.push({ root, file, ...each });
    }
  }
  return hits;
}

const markdown = (hits) => {
  const categories = [...new Set([...Object.keys(CATEGORIES), ...hits.map((each) => each.category)])];
  const lines = ["| What | Client | Core | Files | Most in |", "|---|---|---|---|---|"];
  for (const category of categories) {
    const mine = hits.filter((each) => each.category === category);
    if (mine.length === 0) continue;
    const byFile = Object.entries(Object.groupBy(mine, (each) => `${each.root}:${each.file}`))
      .map(([file, list]) => [file.replace(/^\w+:/, ""), list.length])
      .sort((left, right) => right[1] - left[1]);
    const count = (root) => mine.filter((each) => each.root === root).length;
    const top = byFile
      .slice(0, 2)
      .map(([file, n]) => `\`${file.replace(/^src\//, "")}\` (${n})`)
      .join(", ");
    lines.push(
      `| ${CATEGORIES[category] ?? category} | ${count("client")} | ${count("core")} | ${byFile.length} | ${top} |`,
    );
  }
  lines.push(
    `| **All** | **${hits.filter((each) => each.root === "client").length}** | **${hits.filter((each) => each.root === "core").length}** | **${new Set(hits.map((each) => each.file)).size}** | |`,
  );
  return lines.join("\n");
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const hits = await inventory();
  const jsonAt = process.argv.indexOf("--json");
  if (jsonAt !== -1) writeFileSync(process.argv[jsonAt + 1], `${JSON.stringify(hits, null, 1)}\n`);
  console.log(markdown(hits));
}
