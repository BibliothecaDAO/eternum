// The words check: every place outside the words module (the rules, @bibliothecadao/types' words; the client's phrases,
// src/ui/design-system/kit/words.ts) that writes a number or a time, names a thing where a player reads it, or shows a
// player a string that breaks a voice rule. Read from the TypeScript syntax of the client and core. Left out: tests,
// labs, debug tools, and the renderer's own measuring (diagnostics, benchmarks, traces, instrumentation), which no player
// reads; a number rounded for arithmetic (Number(x.toFixed(2))), an SVG coordinate and anything written to the console
// are not formatting; a table or an enum read as a key is code, not a name. The module's own phrases are held to the
// voice rules too: everything but voice.ts, which states the rules with their bad examples.
//   node scripts/words/check.mjs [--json <file>]   prints the counts as markdown; --json keeps every hit
//   node scripts/words/check.mjs --check           fails, naming each one, on any hit (CI: pnpm words:check)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const GAME = join(REPO, "apps/game");
const ROOTS = { client: join(GAME, "src"), core: join(REPO, "packages/core/src") };
const WORDS_MODULE = ["src/ui/design-system/kit/words.ts"];
const RULES = join(REPO, "packages/types/src/words");
const LEFT_OUT =
  /\.(test|spec)\.[cm]?[jt]sx?$|\.d\.ts$|\/(debug|lab|__fixtures__|gym|benchmark|perf)\/|diagnostics|instrumentation|monitoring|flight-trace|stats-recorder|fixture|-regression\.ts$|\/three\/characters\//;

const CATEGORIES = {
  "number.locale": "toLocaleString (a number, or a date, in the device's language)",
  "number.fixed": "toFixed / toPrecision",
  "number.intl": "Intl.NumberFormat",
  "number.suffix": "a K/M/B suffix built by hand",
  "number.rate": "a rate's unit written by hand (`${n}/h`, per hour, `${n}/min`)",
  "number.percent": "a percent written by hand (`${n}%`, {n}%)",
  "number.grouping": "thousands grouped by hand (a regex over digit triples)",
  "number.points": "points written by the compact amount rule (formatAmount(points)): points are exact",
  "number.floored":
    "a figure floored before it is written (formatAmount(knownBalance(x)), divideByPrecision(x) inside a writer): write knownAmount(x)",
  "time.intl": "Intl.DateTimeFormat / RelativeTimeFormat",
  "time.locale": "toLocaleTimeString / toLocaleDateString",
  "time.units": "a duration built by hand (`${h}h ${m}m`, minutes, seconds)",
  "time.ago": 'an "ago" built by hand',
  "name.enumKey": "an enum key shown as a name (ResourcesIds[id], StructureType[type])",
  "name.trait": "a resource's name read from its table's .trait",
  "name.table": "a name read from a noun table (GUARD_SLOT_NAMES, getMinePresentation…) or a key table shown",
  "name.literal": "a game noun spelled by hand where a player reads it",
  formatter: "a local formatter: a named function that does any of the number or time work above",
  retired: "a retired words file back, or an import of one: its words live in the words module now",
  "number.parse":
    'a written figure read back as a number (Number(formatAmount(x)), parseFloat(text.replace(/,/g, "")))',
};

// The client's words files this module replaced. None may come back, and nothing may import one: a merge that restores
// one would still compile.
const RETIRED = [
  "shell/format",
  "shell/words",
  "three/map-plates/site-name",
  "ui/design-system/kit/amount",
  "ui/design-system/kit/time",
  "ui/design-system/kit/voice",
  "ui/features/relics/relic-words",
  "ui/features/settlement/production/automation-words",
  "ui/features/world/components/armies/army-warning-copy",
  "ui/utils/time-utils",
];
/** Whether an import specifier in a client file names a retired file ("@/ui/design-system/kit/amount", "./amount"). */
const importsRetired = (specifier, fileName) => {
  const target = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? join(dirname(fileName), specifier).split("/src/").pop()
      : null;
  return target !== null && RETIRED.includes(target.replace(/\.tsx?$/, ""));
};

const NAME_ENUMS = new Set(["ResourcesIds", "StructureType", "RealmLevels", "BuildingType", "GuardSlot", "TroopTier"]);
// Tables that only hold names: any read outside the words module is a name written on its own, wherever it goes.
const NAME_TABLES = new Set(["StructureTypeToNameMapping", "getMinePresentation", "GUARD_SLOT_NAMES"]);
// Tables whose values are also keys (models, icons): a read counts only where a player reads it.
const KEY_TABLES = new Set(["RealmLevelNames", "MineKinds"]);
// Where a player reads a value: these attributes, and these fields of an object a screen draws.
const VISIBLE_ATTRIBUTES =
  /^(title|aria-label|aria-description|label|placeholder|alt|tooltip|tip|data-tip|description|heading|subtitle|caption|message|hint)$/;
const VISIBLE_KEYS =
  /^(label|title|text|description|message|tooltip|heading|subtitle|caption|hint|summary|detail|line|reason)$/;
// A string a player cannot read: an attribute or a call that takes code, not words.
const CODE_ATTRIBUTES =
  /^(className|class|style|key|id|type|href|src|to|role|name|data-(?!tip$)[\w-]+|htmlFor|target|rel)$/;
const CODE_CALLS =
  /^(cn|clsx|classNames|twMerge|cva|require|import|querySelector\w*|getElementById|addEventListener|console\.\w+)$/;
const UNIT = /^(?:h|m|s|d|min|mins|sec|secs|hr|hrs)(?![A-Za-z])|^ (?:hours?|minutes?|seconds?|days?)\b/;
const TIME_HINT =
  /Math\.(?:floor|ceil|round)|%|\/\s*60|3600|86_?400|\b(?:hours?|minutes?|mins?|seconds?|secs?|days?)\b/i;
const SUFFIX = /^[KMB](?![A-Za-z])/;
// A rate's unit after its number, with or without a noun between: "/h", " per hour", " points/s".
const RATE_UNIT = /^(?: [A-Za-z]+)?\s?\/\s?(?:h|hr|min|m|s|sec)\b|^ (?:an|per|a) (?:hour|minute|second)\b/;
// A token, a path or a key ("left-queue", "/images/x.png", "army_banner"): code, whatever it spells.
const CODE_TOKEN = /^[\w.$-]*[-_./:][\w.$/:-]*$/;
// An SVG path's commands between its numbers: "M ", " L ", " C ".
const SVG_PATH = /^[\sMLCQSTAZHV,.\d-]*$/i;
const AMOUNT_HINT = /\/\s*1_?000|1e[369]|toFixed|compact|thousand|million/i;

const types = await import("@bibliothecadao/types");
const nounsOf = () =>
  new Set([
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

/** The voice rules, as the words module states them: the module that states them is the one the check holds to. */
const voiceRulesOf = () => types.VOICE_RULES.filter((rule) => rule.forbidden);

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

// A log line: the console, the client's verbose log and its traces, which no player reads.
const LOG_CALL = /^(console\.\w+|verboseLog|trace\w*|logger\.\w+)$/;
const inConsole = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isCallExpression(up) && LOG_CALL.test(calleeName(up))) return true;
  }
  return false;
};

// Points are counted to the unit against the one above (formatPoints, formatExact); the compact amount rule ("12.4K")
// is for amounts held.
const POINTS_NAME = /points?\b|score/i;
const compactPoints = (node) => {
  if (!ts.isCallExpression(node) || calleeName(node) !== "formatAmount" || node.arguments.length === 0) return false;
  if (POINTS_NAME.test(node.arguments[0].getText())) return true;
  const up = node.parent;
  if (ts.isTemplateSpan(up)) return /^ points?\b/.test(up.literal.text);
  if (ts.isJsxExpression(up) && ts.isJsxElement(up.parent)) {
    const after = up.parent.children[up.parent.children.indexOf(up) + 1];
    return after !== undefined && ts.isJsxText(after) && /^ points?\b/.test(after.text);
  }
  return false;
};

// A figure is written for a player and read from the number it was written from, never parsed back: a compact or
// rounded figure ("12.4K", "<1") parses to the wrong number.
// "1234567".replace(/\B(?=(\d{3})+(?!\d))/g, ","): thousands grouped by hand.
const DIGIT_TRIPLES = /\\d\{3\}|\[0-9\]\{3\}/;
const PARSE_CALL = /^(?:Number|(?:Number\.)?parseFloat|(?:Number\.)?parseInt)$/;
const readsBackWritten = (node) => {
  if (!ts.isCallExpression(node) || !PARSE_CALL.test(calleeName(node)) || node.arguments.length === 0) return false;
  let written = false;
  const look = (inner) => {
    if (written) return;
    if (ts.isCallExpression(inner)) {
      const name = calleeName(inner);
      if (/(^|\.)format[A-Z]\w*$/.test(name)) written = true;
      // text.replace(/,/g, ""): grouping commas taken out of a written figure.
      if (/(^|\.)replace$/.test(name) && inner.arguments[0] && ts.isRegularExpressionLiteral(inner.arguments[0]))
        written ||= inner.arguments[0].text.startsWith("/,/");
    }
    ts.forEachChild(inner, look);
  };
  look(node.arguments[0]);
  return written;
};

/** A number written into an SVG path ("M 12.5 40.0 C …"): a coordinate, not a figure a player reads. */
const inSvgPath = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isTemplateExpression(up)) {
      const pieces = [up.head.text, ...up.templateSpans.map((span) => span.literal.text)];
      // A path's commands between its numbers, or a points list ("x,y x,y"): coordinates either way.
      const commands = pieces.some((piece) => /[MLCQ]/i.test(piece));
      const pointsList = pieces.every((piece) => /^[\s,]*$/.test(piece));
      return pieces.every((piece) => SVG_PATH.test(piece)) && (commands || pointsList);
    }
  }
  return false;
};

/**
 * Number(x.toFixed(2)), parseFloat(…), +x.toFixed(2), x.toFixed(n).split("."): a number rounded or taken apart to compute
 * with, not written for a player.
 */
const roundsForArithmetic = (call) => {
  const parent = call.parent;
  if (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.PlusToken) return true;
  // x.toFixed(n).split(".") taken apart into digits, as a fixed-point bigint is built.
  if (ts.isPropertyAccessExpression(parent) && parent.name.text === "split") return true;
  return ts.isCallExpression(parent) && /^(Number|parseFloat|Number\.parseFloat)$/.test(calleeName(parent));
};

/** Whether a template builds code (a key, a path, a class), not words: every piece of its text is a code token. */
const isCodeTemplate = (template) =>
  [template.head.text, ...template.templateSpans.map((span) => span.literal.text)].every(
    (piece) => piece === "" || CODE_TOKEN.test(piece),
  );

/**
 * Whether a value ends where a player reads it: a JSX child, a visible attribute, a word template, a visible field of an
 * object, or what a function named for text (…Label, …Name, …Text, …Title, …Line) returns. A value handed to a call, a
 * key or a comparison is code.
 */
const readsAsText = (node) => {
  for (let child = node, up = node.parent; up && !ts.isSourceFile(up); child = up, up = up.parent) {
    if (ts.isJsxExpression(up)) {
      if (ts.isJsxAttribute(up.parent)) return VISIBLE_ATTRIBUTES.test(up.parent.name.getText());
      return true;
    }
    if (ts.isJsxAttribute(up)) return VISIBLE_ATTRIBUTES.test(up.name.getText());
    if (ts.isTemplateSpan(up)) return !isCodeTemplate(up.parent) && !isCodeString(up.parent);
    if (ts.isPropertyAssignment(up)) return up.initializer === child && VISIBLE_KEYS.test(up.name.getText());
    if (ts.isReturnStatement(up) || (ts.isArrowFunction(up) && up.body === child)) {
      const fn = ts.isReturnStatement(up) ? enclosingFunctionName(up) : namedFunction(up.parent);
      return /(?:Label|Name|Text|Title|Line|Words?|Copy)$/.test(fn ?? "");
    }
    if (ts.isBinaryExpression(up) && up.operatorToken.kind === ts.SyntaxKind.PlusToken) continue;
    if (ts.isConditionalExpression(up) && up.condition !== child) continue;
    if (
      ts.isParenthesizedExpression(up) ||
      ts.isAsExpression(up) ||
      ts.isNonNullExpression(up) ||
      (ts.isBinaryExpression(up) && /^(\?\?|\|\|)$/.test(up.operatorToken.getText()))
    )
      continue;
    return false;
  }
  return false;
};

const enclosingFunctionName = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isFunctionDeclaration(up) || ts.isArrowFunction(up) || ts.isFunctionExpression(up))
      return ts.isFunctionDeclaration(up) ? up.name?.text : namedFunction(up.parent);
  }
  return undefined;
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
    if (ts.isRegularExpressionLiteral(node) && DIGIT_TRIPLES.test(node.text)) return "number.grouping";
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
        if (RATE_UNIT.test(span.literal.text)) return "number.rate";
        // A percent a player reads; a width, a position or a gradient stop in percent is CSS, not words.
        if (span.literal.text.startsWith("%") && readsAsText(node)) return "number.percent";
      }
      if (/\bago\b/.test(templateText(node))) return "time.ago";
    }
    return null;
  };
  const visible = (node, text) => {
    for (const rule of voiceRules) if (rule.forbidden.test(text)) hit(`voice: ${rule.rule}`, node, text);
  };
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      importsRetired(node.moduleSpecifier.text, fileName)
    )
      hit("retired", node.moduleSpecifier, node.moduleSpecifier.text);
    const work = numberOrTime(node);
    if (work) hit(work, node);
    if (readsBackWritten(node)) hit("number.parse", node);
    if (compactPoints(node)) hit("number.points", node);
    if (
      ts.isCallExpression(node) &&
      // The writers that keep a fraction or say "<1"; formatExact writes whole counts.
      /^(formatAmount|formatCharge)$/.test(calleeName(node)) &&
      node.arguments[0] &&
      ts.isCallExpression(node.arguments[0]) &&
      (calleeName(node.arguments[0]) === "knownBalance" ||
        (calleeName(node.arguments[0]) === "divideByPrecision" && node.arguments[0].arguments.length === 1))
    )
      hit("number.floored", node);
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      NAME_ENUMS.has(node.expression.text)
    ) {
      // X[value] reads an enum's key; X[name as keyof typeof X] reads its value from a name, which is code.
      const fromName = ts.isAsExpression(node.argumentExpression) || ts.isStringLiteral(node.argumentExpression);
      if (!fromName && readsAsText(node)) hit("name.enumKey", node);
    }
    // A resource's .trait is only ever its name, so every read goes through resourceName.
    if (ts.isPropertyAccessExpression(node) && node.name.text === "trait") hit("name.trait", node);
    if (ts.isIdentifier(node) && NAME_TABLES.has(node.text) && !ts.isImportSpecifier(node.parent))
      hit("name.table", node);
    if (ts.isIdentifier(node) && KEY_TABLES.has(node.text) && !ts.isImportSpecifier(node.parent)) {
      const parent = node.parent;
      const read =
        ts.isCallExpression(parent) || ts.isElementAccessExpression(parent) || ts.isPropertyAccessExpression(parent)
          ? parent
          : null;
      if (read && read.expression === node && readsAsText(read)) hit("name.table", read);
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isCodeString(node)) {
      if (nouns.has(node.text) && readsAsText(node)) hit("name.literal", node, node.text);
      visible(node, node.text);
    }
    if (ts.isTemplateExpression(node) && !isCodeString(node)) visible(node, templateText(node));
    // {n}% and {n} points/s in JSX: a number written, then its percent sign or its rate's unit as text.
    if (ts.isJsxText(node) && (/^\s*%/.test(node.text) || RATE_UNIT.test(node.text.replace(/^\s+/, " ")))) {
      const index = node.parent.children.indexOf(node);
      const before = node.parent.children[index - 1];
      if (index > 0 && ts.isJsxExpression(before))
        hit(/^\s*%/.test(node.text) ? "number.percent" : "number.rate", before);
    }
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
  const context = { nouns: nounsOf(), voiceRules: voiceRulesOf() };
  const hits = [];
  for (const [root, dir] of Object.entries(ROOTS)) {
    for (const path of sourceFiles(dir)) {
      const file = relative(root === "client" ? GAME : join(REPO, "packages/core"), path);
      if (LEFT_OUT.test(`/${file}`)) continue;
      const found = scanSource(readFileSync(path, "utf8"), path, context);
      const own = WORDS_MODULE.includes(file);
      for (const each of found) if (!own || each.category.startsWith("voice")) hits.push({ root, file, ...each });
    }
  }
  for (const path of sourceFiles(RULES)) {
    if (LEFT_OUT.test(path) || path.endsWith("/voice.ts")) continue;
    const file = relative(join(REPO, "packages/types"), path);
    for (const each of scanSource(readFileSync(path, "utf8"), path, context))
      if (each.category.startsWith("voice")) hits.push({ root: "types", file, ...each });
  }
  for (const retired of RETIRED)
    for (const file of [`src/${retired}.ts`, `src/${retired}.tsx`])
      if (existsSync(join(GAME, file)))
        hits.push({ root: "client", file, line: 1, category: "retired", text: "the file is back" });
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
  if (process.argv.includes("--check")) {
    for (const { root, file, line, category, text } of hits) {
      const at = { core: "packages/core/", types: "packages/types/", client: "apps/game/" }[root];
      console.error(`${at}${file}:${line}  ${CATEGORIES[category] ?? category}: ${text}`);
    }
    if (hits.length > 0) {
      console.error(
        `\n${hits.length} words written outside the words module (@bibliothecadao/types' words, kit/words.ts).`,
      );
      process.exit(1);
    }
    console.log("every word, number, time and name goes through the words module");
  } else console.log(markdown(hits));
}
