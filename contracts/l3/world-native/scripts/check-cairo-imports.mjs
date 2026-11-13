import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export function functionLocalImports(source) {
  const code = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\\n])*'/g, (text) =>
    text.replace(/[^\n]/g, " "),
  );
  const findings = [];
  for (const declaration of code.matchAll(/\bfn\s+(\w+)\b/g)) {
    const signatureEnd = declaration.index + declaration[0].length;
    const delimiter = /[;{]/.exec(code.slice(signatureEnd));
    if (!delimiter || delimiter[0] === ";") continue;
    const start = signatureEnd + delimiter.index + 1;
    let end = start;
    let depth = 1;
    while (end < code.length && depth > 0) {
      if (code[end] === "{") depth++;
      if (code[end] === "}") depth--;
      end++;
    }
    for (const item of code.slice(start, end).matchAll(/\buse\s+[^;]*;/g)) {
      findings.push({
        functionName: declaration[1],
        line: code.slice(0, start + item.index).split("\n").length,
      });
    }
  }
  return findings;
}

function checkImports(revision) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const paths = git(
    revision
      ? ["ls-tree", "-r", "--name-only", revision, "contracts/l3/world-native"]
      : ["ls-files", "contracts/l3/world-native"],
  )
    .split("\n")
    .filter((path) => path.endsWith(".cairo"));
  let errors = 0;
  for (const path of paths) {
    const source = revision ? git(["show", `${revision}:${path}`]) : readFileSync(resolve(root, path), "utf8");
    for (const { functionName, line } of functionLocalImports(source)) {
      console.error(
        `${path}:${line}: move the import in ${functionName} to its owning module; Cairo rejects function-local use items`,
      );
      errors++;
    }
  }
  console.log(`Checked ${paths.length} world Cairo files; ${errors} function-local imports`);
  return errors === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length > 2 && (process.argv[2] !== "--ref" || process.argv.length !== 4)) {
    throw new Error("Usage: node check-cairo-imports.mjs [--ref REVISION]");
  }
  process.exitCode = checkImports(process.argv[3]);
}
