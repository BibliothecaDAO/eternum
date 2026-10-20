import fg from "fast-glob";
import { remarkInclude } from "fumadocs-mdx/config";
import matter from "gray-matter";
import * as fs from "node:fs";
import * as path from "node:path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import { createServer } from "vite";

import { docsAliases, docsDir, llmTxtFile, publicDir } from "./docs/utils/paths.ts";

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm).use(remarkStringify);

const EXPRESSION_TYPES = new Set(["mdxTextExpression", "mdxFlowExpression"]);

const stableDocumentationPath = (file) =>
  path
    .relative(docsDir, file)
    .replace("pages/blitz/military/", "pages/blitz/0-military/")
    .replace("pages/blitz/materials/", "pages/blitz/1-materials/");

/** Every `{expression}` in a page, with the node that holds it, in document order. */
const expressionsOf = (tree) => {
  const found = [];
  const walk = (node) => {
    for (const [index, child] of (node.children ?? []).entries()) {
      if (EXPRESSION_TYPES.has(child.type)) found.push({ parent: node, index, node: child });
      walk(child);
    }
  };
  walk(tree);
  return found;
};

/** The page's import statements that an expression reads: a page's components stay out of the evaluation. */
const importsReadBy = (tree, expressions) => {
  const statements = tree.children
    .filter((node) => node.type === "mdxjsEsm")
    .flatMap((node) => node.value.split(/\n(?=import\s)/))
    .filter((statement) => statement.trimStart().startsWith("import"));
  const reads = (name) => expressions.some(({ node }) => new RegExp(`\\b${name}\\b`).test(node.value));
  return statements.filter((statement) => {
    const names = statement
      .replace(/^import\s+/, "")
      .replace(/\s+from\s+["'].*$/s, "")
      .replace(/\*\s+as\s+/g, "")
      .replace(/[{}]/g, ",")
      .split(",")
      .map((part) =>
        part
          .trim()
          .split(/\s+as\s+/)
          .pop(),
      )
      .filter(Boolean);
    return names.some(reads);
  });
};

/**
 * Replaces each `{expression}` with the value the site renders for it, so the export states numbers, not code. The
 * expressions run in a module beside the page, with the page's own imports, through Vite. A value that is not text or a
 * number (a component) stays as written; an expression that fails to run fails the export.
 */
const evaluateExpressions = async (server, modules, file, tree) => {
  const expressions = expressionsOf(tree);
  if (expressions.length === 0) return;
  const id = `${file}.llm-expressions.mjs`;
  modules.set(
    id,
    `${importsReadBy(tree, expressions).join("\n")}\nexport default [\n${expressions
      .map(({ node }) => `() => (${node.value}),`)
      .join("\n")}\n];\n`,
  );
  const { default: values } = await server.ssrLoadModule(id);
  for (const [position, { parent, index, node }] of [...expressions.entries()].reverse()) {
    const value = values[position]();
    if (typeof value !== "string" && typeof value !== "number") continue;
    const text = String(value);
    if (node.type === "mdxTextExpression") parent.children[index] = { type: "text", value: text };
    else if (text.trim() === "") parent.children.splice(index, 1);
    else parent.children[index] = { type: "paragraph", children: [{ type: "text", value: text }] };
  }
  for (const parent of new Set(expressions.map(({ parent }) => parent))) joinText(parent);
};

/** Joins the text an expression left beside text, so `every{" "}` and the next line read as one run of words. */
const joinText = (parent) => {
  parent.children = parent.children.reduce((joined, child) => {
    const previous = joined.at(-1);
    if (previous?.type === "text" && child.type === "text") previous.value += child.value;
    else joined.push(child);
    return joined;
  }, []);
  for (const child of parent.children)
    if (child.type === "text") child.value = child.value.replace(/[ \t]*\n[ \t]*/g, "\n");
};

/** A Vite server that serves each page's expression module from memory. */
const createExpressionServer = (modules) =>
  createServer({
    configFile: false,
    logLevel: "silent",
    appType: "custom",
    resolve: { alias: docsAliases },
    plugins: [
      {
        name: "llm-txt-expressions",
        resolveId: (id) => (modules.has(id) ? id : null),
        load: (id) => modules.get(id) ?? null,
      },
    ],
  });

const pageText = async (server, modules, file) => {
  const { content, data } = matter(await fs.promises.readFile(file, "utf-8"));
  const vfile = { path: path.relative(process.cwd(), file), value: content };
  const tree = await processor.run(processor.parse(vfile), vfile);
  await evaluateExpressions(server, modules, file, tree);
  return `file: docs/${path.relative(docsDir, file)}
meta: ${JSON.stringify(data, null, 2)}

${processor.stringify(tree)}
`;
};

export default function llmTxtPlugin() {
  return {
    name: "vite-plugin-llm-txt",
    async buildStart() {
      console.log("Generating llm.txt...");
      await fs.promises.mkdir(publicDir, { recursive: true });
      const files = await fg([`${docsDir}/**/*.mdx`], { absolute: true });
      files.sort((left, right) => {
        const leftPath = stableDocumentationPath(left);
        const rightPath = stableDocumentationPath(right);
        const depthDifference = leftPath.split(path.sep).length - rightPath.split(path.sep).length;
        return depthDifference || leftPath.localeCompare(rightPath);
      });
      console.log(`Found ${files.length} mdx files.`);
      const modules = new Map();
      const server = await createExpressionServer(modules);
      try {
        const pages = [];
        for (const file of files) pages.push(await pageText(server, modules, file));
        await fs.promises.writeFile(llmTxtFile, `${pages.join("\n\n---\n\n").trimEnd()}\n`);
      } finally {
        await server.close();
      }
      console.log(`Successfully generated llm.txt at ${llmTxtFile}`);
    },
  };
}
