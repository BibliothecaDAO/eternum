#!/usr/bin/env node
// The client's style inventory: every button, input, tab, tooltip, panel and chip the game draws, and how many
// distinct looks each kind has. It parses each source file (tests and labs left out), reads the classes each element
// is given (string literals, template literals, cn/clsx arguments, and the shared class constants by name), keeps the
// ones that make its look (colour, border, radius, type, shadow, padding, height), and counts the distinct sets.
//
//   node scripts/style-inventory.mjs [--out <dir>]   writes inventory.json and inventory.md (stdout without --out)
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(GAME, "src");
/** Dev-only pages: the labs show elements, they are not the game. */
const LAB = /\/(?:lab|ui\/features\/debug)\//;

const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });

/** A class that makes an element's look rather than place it. */
const VISUAL =
  /^(?:[\w[\]&:-]+:)*!?(?:bg-|border|rounded|text-(?!left|right|center|start|end|ellipsis|wrap|nowrap|balance|clip|pretty)|font-(?!mono$)|shadow|ring|from-|to-|via-|uppercase|lowercase|capitalize|tracking-|leading-|opacity-|backdrop-|outline|italic|px-|py-|p-|h-(?:\d|\[)|min-h-|size-)/;

/** What kind of element a tag, its role and its classes make it; null for any other element. A component counts only
 * when it is a shared one (from the design system): a feature's own component is counted by the elements it draws. */
const kindOf = (tag, attrs, classes, shared) => {
  const raw = /^[a-z]/.test(tag);
  if (raw) {
    if (tag === "button" || attrs.role === "button") return attrs.role === "tab" ? "tab" : "button";
    if (attrs.role === "tab") return "tab";
    if (tag === "input" || tag === "textarea" || tag === "select") return "input";
    const has = (re) => classes.some((c) => re.test(c));
    // A box with its own fill, edge and corner is a panel or a chip: a chip is a small rounded tag of text.
    if (has(/(^|:)bg-/) && has(/(^|:)border/) && has(/(^|:)rounded/)) {
      if (tag === "span" || has(/rounded-full/) || has(/text-\[(?:9|10|11)px\]|text-xxs|text-xs/)) return "chip";
      return "panel";
    }
    return null;
  }
  if (!shared) return null;
  if (/Tooltip$|^Tip$|Tips?$/.test(tag)) return "tooltip";
  if (/Button$/.test(tag)) return "button";
  if (/Input$|Select$|Slider$|Checkbox$/.test(tag)) return "input";
  if (/Tabs?$|TabStrip$|ViewSwitch$/.test(tag)) return "tab";
  if (/Chip$|Badge$|Pill$/.test(tag)) return "chip";
  if (/Panel$|Bubble$|Sheet$|Modal$|Window$|Card$|Plate$/.test(tag)) return "panel";
  return null;
};

/** The class tokens an expression gives: its literal text, and a shared constant by its name. */
const classTokens = (node, file) => {
  const out = [];
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(...n.text.split(/\s+/));
    else if (ts.isTemplateExpression(n)) {
      out.push(...n.head.text.split(/\s+/));
      n.templateSpans.forEach((span) => {
        visit(span.expression);
        out.push(...span.literal.text.split(/\s+/));
      });
    } else if (ts.isIdentifier(n) && /^[A-Z][A-Z0-9_]+$/.test(n.text)) out.push(`@${n.text}`);
    else if (ts.isPropertyAccessExpression(n) && /^[A-Z][A-Z0-9_]+$/.test(n.expression.getText(file)))
      out.push(`@${n.getText(file)}`);
    else ts.forEachChild(n, visit);
  };
  visit(node);
  return out.filter(Boolean);
};

const attributesOf = (element, file) => {
  const attrs = {};
  let classes = [];
  for (const attr of element.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.getText(file);
    const init = attr.initializer;
    if (name === "className" && init) classes = classTokens(ts.isJsxExpression(init) ? init.expression : init, file);
    else if (init && ts.isStringLiteral(init)) attrs[name] = init.text;
    else attrs[name] = true;
  }
  return { attrs, classes };
};

const inventory = { button: [], input: [], tab: [], tooltip: [], panel: [], chip: [] };
/** Places that name an element on hover without a component: the native title, the app's one tooltip (data-tip). */
const hoverNames = { title: [], "data-tip": [] };

const parsed = sources(SRC)
  .map((path) => ({ path, rel: relative(GAME, path) }))
  .filter(({ rel }) => !LAB.test(`/${rel}`))
  .map(({ path, rel }) => ({
    rel,
    file: ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  }));

/** Each file's imported names, as `name -> module` (the module written as imported). */
const importsOf = (file) => {
  const names = new Map();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const module = statement.moduleSpecifier.text;
    const { name, namedBindings } = statement.importClause;
    if (name) names.set(name.text, module);
    if (namedBindings && ts.isNamedImports(namedBindings))
      namedBindings.elements.forEach((e) => names.set(e.name.text, module));
  }
  return names;
};
const moduleKey = (module, name) => `${module.replace(/^.*\/(?=[^/]+\/[^/]+$)/, "")}#${name}`;
// A component is shared when it comes from the design system or three or more files import it: a reusable element.
const importers = new Map();
for (const { file } of parsed)
  for (const [name, module] of importsOf(file)) {
    const key = moduleKey(module, name);
    importers.set(key, (importers.get(key) ?? 0) + 1);
  }
/** Where a component comes from, one name per place however it is imported: the design system's family (kit, atoms,
 * molecules), else its path under src. */
const familyOf = (module, rel) => {
  const path = module.startsWith(".") ? join(dirname(rel), module).replace(/^src\//, "") : module.replace(/^@\//, "");
  return path.match(/design-system\/(kit|atoms|molecules)/)?.[1] ?? path;
};
/** The props that pick a shared component's look. */
const LOOK_PROPS = ["variant", "role", "size", "tone", "kind", "intent"];

for (const { rel, file } of parsed) {
  const imports = importsOf(file);
  const inDesignSystem = /ui\/design-system\//.test(rel);
  const visit = (node) => {
    const element = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null;
    if (element) {
      const tag = element.tagName.getText(file);
      const { attrs, classes } = attributesOf(element, file);
      const at = `${rel}:${file.getLineAndCharacterOfPosition(element.getStart(file)).line + 1}`;
      for (const name of Object.keys(hoverNames))
        if (attrs[name] !== undefined && /^[a-z]/.test(tag)) hoverNames[name].push(at);
      const root = tag.split(".")[0];
      const module = imports.get(root);
      const key = module ? moduleKey(module, root) : `${rel}#${root}`;
      const shared =
        inDesignSystem || (module !== undefined && (/design-system/.test(module) || importers.get(key) >= 3));
      const kind = kindOf(tag, attrs, classes, shared);
      if (kind) {
        const props = LOOK_PROPS.filter((p) => typeof attrs[p] === "string")
          .map((p) => ` ${p}=${attrs[p]}`)
          .join("");
        const look = /^[a-z]/.test(tag)
          ? classes
              .filter((c) => c.startsWith("@") || VISUAL.test(c))
              .toSorted()
              .join(" ")
          : `<${tag}${props}> (${module ? familyOf(module, rel) : "local"})`;
        inventory[kind].push({ at, tag, look });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
}

const summary = Object.fromEntries(
  Object.entries(inventory).map(([kind, found]) => {
    const looks = new Map();
    for (const item of found) {
      const entry = looks.get(item.look) ?? { look: item.look, count: 0, at: [] };
      entry.count += 1;
      if (entry.at.length < 3) entry.at.push(item.at);
      looks.set(item.look, entry);
    }
    const sorted = [...looks.values()].toSorted((a, b) => b.count - a.count);
    return [
      kind,
      {
        uses: found.length,
        distinct: sorted.length,
        components: sorted.filter((l) => l.look.startsWith("<")).length,
        local: sorted.filter((l) => !l.look.startsWith("<")).length,
        looks: sorted,
      },
    ];
  }),
);
summary.hoverNames = { title: hoverNames.title.length, "data-tip": hoverNames["data-tip"].length };

const markdown = [
  "| kind | uses | distinct looks | of which components | of which local class sets |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...Object.entries(inventory).map(
    ([kind]) =>
      `| ${kind} | ${summary[kind].uses} | ${summary[kind].distinct} | ${summary[kind].components} | ${summary[kind].local} |`,
  ),
  "",
  `Hover names without a component: ${summary.hoverNames.title} native \`title\`, ${summary.hoverNames["data-tip"]} \`data-tip\`.`,
  "",
  ...Object.entries(inventory).flatMap(([kind]) => [
    `## ${kind}: ${summary[kind].distinct} looks`,
    "",
    ...summary[kind].looks
      .slice(0, 40)
      .map((l) => `- ${l.count}× \`${l.look || "(no visual classes)"}\` — ${l.at.join(", ")}`),
    "",
  ]),
].join("\n");

const outIndex = process.argv.indexOf("--out");
if (outIndex === -1) process.stdout.write(`${markdown}\n`);
else {
  const dir = process.argv[outIndex + 1];
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "inventory.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(dir, "inventory.md"), markdown);
  process.stdout.write(`${markdown.split("\n").slice(0, 10).join("\n")}\n`);
}
