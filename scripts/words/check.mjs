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
  "number.charge":
    "a cost, price or fee written by formatAmount or formatExact: every charge reads rounded, by formatCharge",
  "number.bare":
    "an amount written into text as it is (`${resource.amount} wheat`): raw, ungrouped and unrounded; a writer writes it (formatCharge)",
  "number.threshold":
    'a least amount to type written by a charge or amount writer (`at least ${formatCharge(x)}`): it reads "<1" under one; write it as typed (formatTypedNumber)',
  "number.pair":
    "a cost held against what is held, written as two figures (`${formatAmount(held)} / ${formatCharge(cost)}`): formatHeldAgainst writes the pair, so a shortfall never reads as met",
  "number.plural":
    'a noun\'s number picked by hand (n === 1 ? "army" : "armies"), or a count before a fixed plural (`${max} slots`, `${count} ${WORDS.players}`): formatCount picks it',
  "words.doubled": "a writer's own noun or unit written again after it ({formatPoints(n)} points)",
  "number.floored":
    "a figure floored before it is written (divideByPrecision(x) inside a writer): write knownAmount(x)",
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
  "number.formula":
    "two figures joined by an operator in JSX ({count} × {rate}, {base} + {share}): a player reads the one result, never the sum",
  "words.long":
    "a line past seven words where a player reads it: a panel shows the control, the number and the action, never a sentence under them (a tooltip may say more)",
  "number.population":
    'a population written by hand ("1 / 6", "2 free of 6"): formatPopulation writes it one way, used of all it can hold',
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
const NAME_TABLES = new Set([
  "StructureTypeToNameMapping",
  "getMinePresentation",
  "GUARD_SLOT_NAMES",
  "BuildingTypeToString",
]);
// Tables whose values are also keys (models, icons): a read counts only where a player reads it.
const KEY_TABLES = new Set(["RealmLevelNames", "MineKinds"]);
// Where a player reads a value: these attributes, and these fields of an object a screen draws.
const VISIBLE_ATTRIBUTES =
  /^(title|aria-label|aria-description|label|placeholder|alt|tooltip|tip|data-tip|description|heading|subtitle|caption|message|hint|detail)$/;
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

// A charge reads one way wherever it is shown (formatCharge, rounded); through the amount or count writers the same
// cost would read "1,250" in one place and "1.3K" or "1,250.4" in another. A unit price is a figure (formatFigure).
const CHARGE_NAME = /cost|price|charge|fee(?![a-z])/i;
/** The name a written value goes by: `price`, `option.populationCost`, through a conversion (`lordsOf(cost)`). */
const valueName = (node) => {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isParenthesizedExpression(node)) return valueName(node.expression);
  if (ts.isCallExpression(node) && node.arguments.length === 1) return valueName(node.arguments[0]);
  return "";
};
const chargeByOtherWriter = (node) =>
  ts.isCallExpression(node) &&
  /^(formatAmount|formatExact)$/.test(calleeName(node)) &&
  node.arguments[0] !== undefined &&
  CHARGE_NAME.test(valueName(node.arguments[0]));

// An amount a player reads always goes through a writer: put in text as it is, 28.15 wheat reads "28.15", 0.1 reads
// "0.1" and 12000 LORDS reads "12000". Read here: a value named for an amount, written into text, that its declaration
// does not show to be text already (a writer's result, a string, a node) — through whatever leaves it unchanged on the
// way: parentheses, a type assertion, a fallback (amount ?? 0) or a choice (shown ? amount : "—"). A words table's
// entry (PROFILE_WORDS.removeCost) is text. In JSX a bare name is left out, as it is often a node built for its slot
// ({price}); a field read off a record ({resource.amount}) is checked.
const BARE_AMOUNT_NAME =
  /^(?:amount|cost|price|fee|paid|reward|gain|yield)s?$|(?:Amount|Cost|Price|Fee|Paid|Reward|Gain|Yield)s?$/;
const isWordsTableEntry = (node) =>
  ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) &&
  /^[A-Z][A-Z0-9_]+$/.test(node.expression.text);

/** What may be written where an expression stands: itself, or each alternative of a wrapper that passes values on. */
const writtenAlternatives = (node) => {
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    return writtenAlternatives(node.expression);
  if (
    ts.isBinaryExpression(node) &&
    (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
    return [...writtenAlternatives(node.left), ...writtenAlternatives(node.right)];
  if (ts.isConditionalExpression(node))
    return [...writtenAlternatives(node.whenTrue), ...writtenAlternatives(node.whenFalse)];
  return [node];
};

const TEXT_TYPE = /^(?:string|ReactNode|ReactElement|JSX\.Element|React\.ReactNode|React\.ReactElement)$/;
/** undefined or null in a union: what a value may lack, not what it holds. */
const holdsNothing = (type) =>
  type.kind === ts.SyntaxKind.UndefinedKeyword ||
  (ts.isLiteralTypeNode(type) && type.literal.kind === ts.SyntaxKind.NullKeyword);
/** What a type annotation holds: "number", "text" (a string or a node), or "unknown". */
const typeHolds = (type) => {
  if (!type) return "unknown";
  if (type.kind === ts.SyntaxKind.NumberKeyword || type.kind === ts.SyntaxKind.BigIntKeyword) return "number";
  if (type.kind === ts.SyntaxKind.StringKeyword) return "text";
  if (ts.isLiteralTypeNode(type)) return ts.isStringLiteral(type.literal) ? "text" : "unknown";
  if (ts.isTypeReferenceNode(type)) return TEXT_TYPE.test(type.typeName.getText()) ? "text" : "unknown";
  if (ts.isParenthesizedType(type)) return typeHolds(type.type);
  if (ts.isUnionTypeNode(type)) {
    const held = type.types.filter((member) => !holdsNothing(member)).map(typeHolds);
    if (held.includes("number")) return "number";
    return held.length > 0 && held.every((each) => each === "text") ? "text" : "unknown";
  }
  return "unknown";
};
/** A member's type in a type literal, or in an interface or type alias the same file declares. */
const memberType = (type, name, file) => {
  if (!type) return undefined;
  let members;
  if (ts.isTypeLiteralNode(type)) members = type.members;
  else if (ts.isTypeReferenceNode(type)) {
    const named = file.statements.find(
      (statement) =>
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        statement.name.text === type.typeName.getText(),
    );
    if (named && ts.isInterfaceDeclaration(named)) members = named.members;
    else if (named && ts.isTypeLiteralNode(named.type)) members = named.type.members;
  }
  const member = members?.find((each) => ts.isPropertySignature(each) && each.name.getText() === name);
  return member?.type;
};
/** The declaration a name refers to where it is used: a variable, a parameter or a destructured binding in scope. */
const declarationOf = (identifier) => {
  const name = identifier.text;
  const bindingNamed = (binding) => {
    if (ts.isIdentifier(binding)) return null;
    for (const element of binding.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (ts.isIdentifier(element.name) && element.name.text === name) return element;
      const nested = bindingNamed(element.name);
      if (nested) return nested;
    }
    return null;
  };
  const declared = (declaration) =>
    ts.isIdentifier(declaration.name)
      ? declaration.name.text === name
        ? declaration
        : null
      : bindingNamed(declaration.name);
  for (let scope = identifier.parent; scope; scope = scope.parent) {
    if (ts.isFunctionLike(scope))
      for (const parameter of scope.parameters ?? []) {
        const found = declared(parameter);
        if (found) return found;
      }
    const statements = ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) ? scope.statements : [];
    for (const statement of statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const found = declared(declaration);
        if (found) return found;
      }
    }
  }
  return null;
};
/** What a declaration holds, from its type annotation or its value; a destructured name from its owner's type. */
const declarationHolds = (declaration, file, depth) => {
  if (!declaration) return "unknown";
  if (ts.isBindingElement(declaration)) {
    const owner = declaration.parent.parent;
    const key = (declaration.propertyName ?? declaration.name).getText();
    return ts.isObjectBindingPattern(declaration.parent) ? typeHolds(memberType(owner.type, key, file)) : "unknown";
  }
  if (declaration.type) return typeHolds(declaration.type);
  return declaration.initializer ? valueHolds(declaration.initializer, file, depth) : "unknown";
};
const TEXT_CALL = /^(?:format[A-Z]\w*|\w+(?:Line|Text|Label|Words))$/;
/** What an expression holds once written: "text" when every alternative is text, "number" when one is a figure. */
const valueHolds = (node, file, depth = 0) => {
  const held = writtenAlternatives(node).map((alternative) => {
    if (
      ts.isStringLiteralLike(alternative) ||
      ts.isTemplateExpression(alternative) ||
      ts.isJsxElement(alternative) ||
      ts.isJsxSelfClosingElement(alternative) ||
      ts.isJsxFragment(alternative)
    )
      return "text";
    if (ts.isNumericLiteral(alternative) || ts.isBigIntLiteral(alternative)) return "number";
    if (ts.isCallExpression(alternative))
      return TEXT_CALL.test(calleeName(alternative).replace(/^.*\./, "")) ? "text" : "unknown";
    if (ts.isIdentifier(alternative) && depth < 4) return declarationHolds(declarationOf(alternative), file, depth + 1);
    if (ts.isPropertyAccessExpression(alternative) && ts.isIdentifier(alternative.expression)) {
      const owner = declarationOf(alternative.expression);
      const ownerType = owner && !ts.isBindingElement(owner) ? owner.type : undefined;
      return typeHolds(memberType(ownerType, alternative.name.text, file));
    }
    return "unknown";
  });
  if (held.includes("number")) return "number";
  return held.every((each) => each === "text") ? "text" : "unknown";
};
/** A value named for an amount, which nothing shows to be written already. */
const bareAmount = (node, file) =>
  (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) &&
  !isWordsTableEntry(node) &&
  BARE_AMOUNT_NAME.test(valueName(node)) &&
  valueHolds(node, file) !== "text";
const bareAmountText = (node, file) => {
  if (ts.isTemplateExpression(node))
    return (
      !inDiagnostic(node) &&
      readsAsText(node) &&
      node.templateSpans.some((span) => writtenAlternatives(span.expression).some((each) => bareAmount(each, file)))
    );
  return (
    ts.isJsxExpression(node) &&
    node.expression !== undefined &&
    (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) &&
    writtenAlternatives(node.expression).some((each) => ts.isPropertyAccessExpression(each) && bareAmount(each, file))
  );
};

// A least amount the player is told to type ("Spend at least 0.8 Copper") is an amount to type, not a charge: through
// formatCharge or formatAmount it reads "<1" under one unit and says nothing. Read here, in text a player reads (as the
// other text checks bound it): "at least" right before a figure those writers write, through any wrapper that passes it
// on, in a template or in JSX.
const AT_LEAST = /\bat least\s*$/i;
const writesChargeOrAmount = (expression) =>
  expression !== undefined &&
  writtenAlternatives(expression).some(
    (each) => ts.isCallExpression(each) && /^(formatCharge|formatAmount)$/.test(calleeName(each)),
  );
/** The words a JSX child spells: its text, or a string written as an expression ({"at least "}). */
const jsxChildText = (child) =>
  ts.isJsxText(child)
    ? child.text
    : ts.isJsxExpression(child) && child.expression && ts.isStringLiteralLike(child.expression)
      ? child.expression.text
      : null;
const thresholdByChargeWriter = (node) => {
  if (ts.isTemplateExpression(node))
    return (
      !inDiagnostic(node) &&
      readsAsText(node) &&
      node.templateSpans.some((span, index) => {
        const before = index === 0 ? node.head.text : node.templateSpans[index - 1].literal.text;
        return AT_LEAST.test(before) && writesChargeOrAmount(span.expression);
      })
    );
  if (!ts.isJsxElement(node) && !ts.isJsxFragment(node)) return false;
  const children = node.children.filter((child) => !isBlank(child));
  return children.some((child, index) => {
    const next = children[index + 1];
    const words = jsxChildText(child);
    return (
      words !== null &&
      AT_LEAST.test(words) &&
      next !== undefined &&
      ts.isJsxExpression(next) &&
      writesChargeOrAmount(next.expression)
    );
  });
};

// A cost beside what is held, each side rounded alone, can read as met while short ("28 / 28" for 28.10 of 28.15); the
// pair is one writer's (formatHeldAgainst). Read here: two writer calls joined by a slash, one of them a charge.
const writerName = (node) =>
  node && ts.isCallExpression(node) && /^format[A-Z]/.test(calleeName(node)) ? calleeName(node) : null;
const SLASH = /^\s*\/\s*$/;
const isChargePair = (left, right) => {
  const names = [writerName(left), writerName(right)];
  return names.every(Boolean) && names.includes("formatCharge");
};
// What reads between two figures in JSX: text, less the blank lines and the {" "} a formatter puts at a line's end.
const isBlank = (child) =>
  (ts.isJsxText(child) && child.text.trim() === "") ||
  (ts.isJsxExpression(child) &&
    child.expression &&
    ts.isStringLiteral(child.expression) &&
    child.expression.text.trim() === "");
const handPair = (node) => {
  if (ts.isTemplateExpression(node))
    return node.templateSpans.some(
      (span, index) =>
        SLASH.test(span.literal.text) && isChargePair(span.expression, node.templateSpans[index + 1]?.expression),
    );
  if (!ts.isJsxElement(node) && !ts.isJsxFragment(node)) return false;
  const children = node.children.filter((child) => !isBlank(child));
  return children.some((child, index) => {
    const [left, right] = [children[index - 1], children[index + 1]];
    return (
      ts.isJsxText(child) &&
      SLASH.test(child.text) &&
      left !== undefined &&
      right !== undefined &&
      ts.isJsxExpression(left) &&
      ts.isJsxExpression(right) &&
      isChargePair(left.expression, right.expression)
    );
  });
};

// What each writer already writes after its figure. Written again after the call, it reads twice: "35 points points".
// A "%" or a rate's unit after any figure is number.percent or number.rate already.
const TIME_TAIL = /^\s*(?:s|m|h|d|secs?|seconds?|mins?|minutes?|hrs?|hours?|days?)\b/;
const WRITTEN_TAIL = new Map([
  ["formatPoints", /^\s*(?:points?|pts|VP)\b/i],
  ["formatAgo", /^\s*ago\b/],
  ["formatDuration", TIME_TAIL],
  ["formatWait", TIME_TAIL],
  ["formatGameClock", TIME_TAIL],
  ["formatOrdinal", /^(?:st|nd|rd|th)\b/],
  ["formatPercent", /^\s*percent\b/],
]);
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The noun formatCount writes, from its literal arguments: formatCount(n, "slot") writes "slot" or "slots". */
const countTail = (call) => {
  const [, singular, plural] = call.arguments;
  if (!singular || !ts.isStringLiteralLike(singular)) return null;
  const nouns = [singular.text, plural && ts.isStringLiteralLike(plural) ? plural.text : `${singular.text}s`];
  return new RegExp(`^\\s*(?:${nouns.map(escape).join("|")})\\b`);
};
/** The text written right after a call: the template's next literal, a + "…" after it, or JSX text beside it. */
const textAfter = (node) => {
  let call = node;
  let up = node.parent;
  while (up && (ts.isParenthesizedExpression(up) || ts.isNonNullExpression(up) || ts.isAsExpression(up))) {
    call = up;
    up = up.parent;
  }
  if (!up) return null;
  if (ts.isTemplateSpan(up)) return up.literal.text;
  if (ts.isBinaryExpression(up) && up.left === call && up.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    if (ts.isStringLiteralLike(up.right)) return up.right.text;
    if (ts.isTemplateExpression(up.right)) return up.right.head.text;
    return null;
  }
  if (ts.isJsxExpression(up) && (ts.isJsxElement(up.parent) || ts.isJsxFragment(up.parent))) {
    const siblings = up.parent.children;
    let text = "";
    for (const sibling of siblings.slice(siblings.indexOf(up) + 1)) {
      if (ts.isJsxText(sibling)) text += sibling.text;
      else if (ts.isJsxExpression(sibling) && sibling.expression && ts.isStringLiteralLike(sibling.expression))
        text += sibling.expression.text;
      else break;
      if (text.trim()) break;
    }
    return text;
  }
  return null;
};
const writtenTwice = (node) => {
  if (!ts.isCallExpression(node)) return false;
  const name = calleeName(node).replace(/^.*\./, "");
  const tail = name === "formatCount" ? countTail(node) : WRITTEN_TAIL.get(name);
  if (!tail) return false;
  const after = textAfter(node);
  return after !== null && tail.test(after);
};

// A noun's number is the words module's one plural rule (formatCount), never a ternary on a count of one. Read from the
// two words the ternary picks between, so a count compared to one for anything else is left alone.
const VERB_PLURALS = new Map([
  ["is", "are"],
  ["was", "were"],
  ["has", "have"],
]);
const pluralOf = (one, many) =>
  many === `${one}s` ||
  many === `${one}es` ||
  (/[^aeiou]y$/.test(one) && many === `${one.slice(0, -1)}ies`) ||
  VERB_PLURALS.get(one) === many;
const ONE_OR_TWO = (node) => ts.isNumericLiteral(node) && (node.text === "1" || node.text === "2");
const handPlural = (node) => {
  if (!ts.isConditionalExpression(node)) return false;
  let condition = node.condition;
  while (ts.isParenthesizedExpression(condition)) condition = condition.expression;
  if (!ts.isBinaryExpression(condition) || !(ONE_OR_TWO(condition.left) || ONE_OR_TWO(condition.right))) return false;
  if (!/^(?:===|!==|==|!=|<|<=|>|>=)$/.test(condition.operatorToken.getText())) return false;
  const [a, b] = [wordsOf(node.whenTrue), wordsOf(node.whenFalse)];
  if (a === null || b === null) return false;
  return pluralOf(a, b) || pluralOf(b, a);
};
/** A branch's words without its count: "1 exchange" and `${count} exchanges` read "exchange" and "exchanges". */
const wordsOf = (node) => {
  if (ts.isStringLiteralLike(node)) return node.text.replace(/^\d[\d,]*\s*/, "");
  if (ts.isTemplateExpression(node))
    return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("").trim();
  return null;
};

// Text no player reads: a log line, or a thrown error's message.
const inDiagnostic = (node) => {
  if (inConsole(node)) return true;
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isThrowStatement(up)) return true;
    if (ts.isNewExpression(up) && /Error$/.test(up.expression.getText())) return true;
  }
  return false;
};
/** A branch that writes its count before its noun ("1 exchange", `${count} exchanges`): words, never a route or a key. */
const writesCount = (branch) =>
  (ts.isStringLiteralLike(branch) && /^\d/.test(branch.text)) ||
  (ts.isTemplateExpression(branch) && branch.head.text === "");
/**
 * A hand-picked plural a player reads: the fixed-plural check's boundary (not in a log, read as text), or a branch
 * that writes the count itself, which only words do. A route, a key or a diagnostic picked by count is code.
 */
const handPluralText = (node) =>
  handPlural(node) &&
  !inDiagnostic(node) &&
  (readsAsText(node) || writesCount(node.whenTrue) || writesCount(node.whenFalse));

// A count written before a noun in its plural, whatever the count: "All 1 field army slots are in use". Read where the
// count is plainly one (a length, a count, a maximum) and the noun is lower case, in text a player reads.
const COUNT_NAME = /(?:^|\.)(?:length|\w*[cC]ount|max[A-Z]\w*)$/;
const PLURAL_NOUN = /^ (?:[a-z]+ )*[a-z]+[^s\W]s\b/;
// A plural noun from a words table, written after a count: `${count} ${PLAY_WORDS.players}` reads "1 Players".
const PLURAL_WORD = /\.[a-z]+[^s\W]s$/i;
const fixedPlural = (span, next) => {
  let expression = span.expression;
  if (ts.isCallExpression(expression) && /^format(?:Exact|Amount)$/.test(calleeName(expression)))
    expression = expression.arguments[0] ?? expression;
  if (!COUNT_NAME.test(expression.getText())) return false;
  return (
    PLURAL_NOUN.test(span.literal.text) ||
    (span.literal.text === " " && next !== undefined && PLURAL_WORD.test(next.expression.getText()))
  );
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
const TEXT_NAME = /(?:Label|Name|Text|Title|Line|Words?|Copy|Message)$/;
const readsAsText = (node) => {
  for (let child = node, up = node.parent; up && !ts.isSourceFile(up); child = up, up = up.parent) {
    if (ts.isJsxExpression(up)) {
      if (ts.isJsxAttribute(up.parent)) return VISIBLE_ATTRIBUTES.test(up.parent.name.getText());
      return true;
    }
    if (ts.isJsxAttribute(up)) return VISIBLE_ATTRIBUTES.test(up.name.getText());
    if (ts.isTemplateSpan(up)) return !isCodeTemplate(up.parent) && !isCodeString(up.parent);
    if (ts.isPropertyAssignment(up)) return up.initializer === child && VISIBLE_KEYS.test(up.name.getText());
    // const limitMessage = …: a value named for the words it holds, as a function named for them returns them.
    if (ts.isVariableDeclaration(up)) return up.initializer === child && TEXT_NAME.test(up.name.getText());
    if (ts.isReturnStatement(up) || (ts.isArrowFunction(up) && up.body === child)) {
      const fn = ts.isReturnStatement(up) ? enclosingFunctionName(up) : namedFunction(up.parent);
      return TEXT_NAME.test(fn ?? "");
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

// A realm's population reads one way, Blitz's and Frontier's alike: what its buildings take of all it can hold, "5/6",
// written by the words module's formatPopulation (formatPopulationInWords in a line). A count of it set against another by hand ("1 / 6", "2 free of 6",
// "Population 5 of 6") is a second way, whichever side it counts.
const POPULATION_NAME = /population|people/i;
const COUNTED_AGAINST = /7\s*(?:\/|of\b|free\b)/;
const JSX_AGAINST = /^\s*(?:\/|of\b|free\b)/;
const handPopulation = (node) => {
  if (ts.isTemplateExpression(node))
    return (
      !inDiagnostic(node) &&
      !isCodeString(node) &&
      (POPULATION_NAME.test(templateText(node)) ||
        node.templateSpans.some((span) => POPULATION_NAME.test(span.expression.getText()))) &&
      COUNTED_AGAINST.test(templateText(node))
    );
  if (!ts.isJsxText(node) || !JSX_AGAINST.test(node.text)) return false;
  const siblings = node.parent.children;
  const before = siblings[siblings.indexOf(node) - 1];
  return before !== undefined && ts.isJsxExpression(before) && POPULATION_NAME.test(before.getText());
};

// A formula drawn in JSX: an operator alone between two written figures, "{count} × {rate}", "{base} + {share}". The
// voice rule "A number, never a formula" finds one inside a string; this finds the one split across JSX children.
const JSX_OPERATOR = /^\s*[×✕+=]\s*$/;
const jsxFormula = (node) => {
  if (!ts.isJsxText(node) || !JSX_OPERATOR.test(node.text)) return false;
  const siblings = node.parent.children;
  const index = siblings.indexOf(node);
  return ts.isJsxExpression(siblings[index - 1] ?? node) && ts.isJsxExpression(siblings[index + 1] ?? node);
};

// A line, never a paragraph (owner, 26 October 2026: "good UI/UX doesnt need subtext"): a panel shows the control, the
// number and the action, and a hint a player needs once is a tutorial's, not a line that stays. A string a player reads
// on screen holds at most LINE_WORDS words (the design rules' "seven at most"), each substitution one. A tooltip may say
// more: a hover attribute, a `tooltip` field, or a phrase named for one (…Tip, …Tooltip). Left out: pages read as text
// (the legal pages, the patch notes), a post the player shares (x-share-messages) and the renderer's diagnostics
// (game-renderer-policy).
const LINE_WORDS = 7;
const HOVER_ATTRIBUTES = /^(title|tooltip|tip|data-tip|aria-[\w-]+|alt)$/;
const HOVER_NAME = /(?:Tips?|Tooltip|TIPS?|TOOLTIP)$/;
const READ_AS_PAGES = /\/shell\/(?:legal\.tsx|generated\/)|\/x-share-messages\.ts$|\/game-renderer-policy\.ts$/;
const wordCount = (text) => text.split(/\s+/).filter((word) => /[\p{L}\d]/u.test(word)).length;
// Words for a developer, not a player: an error's or a log's message (super(…) in an Error class, new …Exception(…),
// a call to …warn or …log), a line that opens with a code name (VITE_PUBLIC_…, UNKNOWN_RELEASE_SCHEMA:) or names a
// function to call (captureBaseline(label)), and a value with fewer than two words in it (a CSS shadow, an SVG path). A
// text of several lines (a build order's default in its field) is a document the player edits, not a line.
const DEVELOPER_WORDS = /^[A-Z][A-Z\d]*_[A-Z\d_]+\b|\b[a-z]+[A-Z]\w*\([^)]*\)|\n/;
const LOG_OR_ERROR = /(?:^|\.)(?:warn|log|debug|info|error)$/;
const forDevelopers = (node, text) => {
  if (DEVELOPER_WORDS.test(text) || (text.match(/\b[A-Za-z]{2,}\b/g) ?? []).length < 2) return true;
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isCallExpression(up) && up.expression.kind === ts.SyntaxKind.SuperKeyword) return true;
    if (ts.isCallExpression(up) && LOG_OR_ERROR.test(calleeName(up))) return true;
    if (ts.isNewExpression(up) && /(?:Error|Exception)$/.test(up.expression.getText())) return true;
    if (ts.isBlock(up)) break;
  }
  return false;
};
// Prose, wherever it is handed (a coach's step(key, line), a refusal's reason): it starts with a capital, and few of its
// words are code (a class name, a key, a path, a camelCase name).
const CODE_WORD = /[-:[\]/_=<>{}]|[a-z][A-Z]/;
const isProse = (text) => {
  const words = text.trim().split(/\s+/);
  return /^[A-Z]/.test(text.trim()) && words.filter((word) => CODE_WORD.test(word)).length * 4 < words.length;
};
const onHover = (node) => {
  for (let up = node.parent; up && !ts.isSourceFile(up); up = up.parent) {
    if (ts.isJsxAttribute(up)) return HOVER_ATTRIBUTES.test(up.name.getText());
    if (ts.isPropertyAssignment(up) && /^(?:tooltip|tip)$|(?:Tips?|Tooltip)$/.test(up.name.getText())) return true;
    if ((ts.isVariableDeclaration(up) || ts.isFunctionDeclaration(up)) && up.name && HOVER_NAME.test(up.name.getText()))
      return true;
  }
  return false;
};
/** A JSX element's run of text and values from this child on, a value as one word; none past the run's first text. */
const jsxRun = (node) => {
  const siblings = node.parent.children ?? [];
  const at = siblings.indexOf(node);
  const inRun = (child) => child !== undefined && (ts.isJsxText(child) || ts.isJsxExpression(child));
  let first = at;
  while (inRun(siblings[first - 1])) first -= 1;
  if (siblings.slice(first, at).some((child) => ts.isJsxText(child) && child.text.trim())) return null;
  let text = "";
  for (let index = first; inRun(siblings[index]); index += 1)
    text += ts.isJsxText(siblings[index]) ? siblings[index].text : " 7 ";
  return text.replace(/\s+/g, " ").trim();
};
/** The words a node puts on screen when they run past a line, else null. */
const longLine = (node, wordsModule) => {
  let text = null;
  if (ts.isJsxText(node) && node.text.trim()) text = jsxRun(node);
  else if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) &&
    !isCodeString(node) &&
    !inDiagnostic(node) &&
    !inConsole(node)
  ) {
    const written = ts.isTemplateExpression(node) ? templateText(node) : node.text;
    if ((wordsModule || readsAsText(node) || isProse(written)) && !forDevelopers(node, written)) text = written;
  }
  return text !== null && wordCount(text) > LINE_WORDS && !onHover(node) ? text : null;
};

/** Every hit in one file's source: { category, line, text }. */
export function scanSource(source, fileName, { nouns, voiceRules, wordsModule = false }) {
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
    if (ts.isTemplateExpression(node) && !isCodeString(node)) {
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
    if (chargeByOtherWriter(node)) hit("number.charge", node);
    if (handPair(node)) hit("number.pair", node);
    if (bareAmountText(node, file)) hit("number.bare", node);
    if (thresholdByChargeWriter(node)) hit("number.threshold", node);
    if (writtenTwice(node)) hit("words.doubled", node);
    if (handPluralText(node)) hit("number.plural", node);
    if (handPopulation(node)) hit("number.population", node);
    if (ts.isTemplateExpression(node) && !inDiagnostic(node) && !handPlural(node.parent) && readsAsText(node))
      node.templateSpans.forEach((span, index) => {
        if (fixedPlural(span, node.templateSpans[index + 1])) hit("number.plural", span);
      });
    if (
      ts.isCallExpression(node) &&
      // The writers that keep a fraction or say "<1"; formatExact writes whole counts.
      /^(formatAmount|formatCharge)$/.test(calleeName(node)) &&
      node.arguments[0] &&
      ts.isCallExpression(node.arguments[0]) &&
      calleeName(node.arguments[0]) === "divideByPrecision" &&
      node.arguments[0].arguments.length === 1
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
    if (jsxFormula(node)) hit("number.formula", node.parent.children[node.parent.children.indexOf(node) - 1]);
    const long = READ_AS_PAGES.test(fileName) ? null : longLine(node, wordsModule);
    if (long) hit("words.long", node, long);
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
      const own = WORDS_MODULE.includes(file);
      const found = scanSource(readFileSync(path, "utf8"), path, { ...context, wordsModule: own });
      const kept = (each) => !own || each.category.startsWith("voice") || each.category === "words.long";
      for (const each of found) if (kept(each)) hits.push({ root, file, ...each });
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
