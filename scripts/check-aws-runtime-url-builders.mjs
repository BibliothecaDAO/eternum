import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const allowedBuilderFile = "common/factory/runtime-endpoints.ts";
const defaultScannedRoots = [
  ".github/workflows/aws-runtime-deployer.yml",
  ".github/workflows/factory-indexer-maintenance.yml",
  ".github/workflows/factory-torii-deployer.yml",
  ".github/workflows/game-launch.yml",
  "common/factory",
  "config/deployer/clean",
  "deploy/aws",
];
const ignoredPathParts = ["/tests/", "/README.md"];
const inlineRuntimePathPattern = /[`'"][^`'"\n]*\/x\/\$\{/;
const retiredWssPattern = /(["'`])wss\1|\/wss\b|\bwss\b/;
const readmePath = process.env.AWS_RUNTIME_URL_CHECK_README_PATH || "deploy/aws/README.md";
const protocolSupportSnippets = ["## Protocol Support", "grpc-web", "WebSocket", "native gRPC", "not supported"];

function main() {
  const inspectedFiles = collectScannedFiles().filter(shouldInspectFile);
  const violations = [
    ...inspectedFiles
      .filter((filePath) => filePath !== allowedBuilderFile)
      .flatMap((filePath) => findInlineRuntimePathBuilders(filePath)),
    ...inspectedFiles.flatMap((filePath) => findRetiredWssEndpoints(filePath)),
    ...validateProtocolSupportDocs(),
  ];

  if (violations.length === 0) {
    return;
  }

  console.error("AWS runtime endpoint URL checks failed:");
  for (const violation of violations) {
    console.error(`- ${formatViolation(violation)}`);
  }
  process.exit(1);
}

function collectScannedFiles() {
  const scannedRoots = resolveScannedRoots();
  return scannedRoots.flatMap((root) => {
    const absolutePath = resolveRepoPath(root);
    if (!fs.existsSync(absolutePath)) {
      return [];
    }

    return fs.statSync(absolutePath).isDirectory() ? collectFilesUnder(root) : [root];
  });
}

function resolveScannedRoots() {
  const configured = process.env.AWS_RUNTIME_URL_CHECK_SOURCE_PATHS?.trim();
  if (!configured) {
    return defaultScannedRoots;
  }

  return configured
    .split(",")
    .map((path) => path.trim())
    .filter(Boolean);
}

function collectFilesUnder(relativeDirectory) {
  const absoluteDirectory = resolveRepoPath(relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      return collectFilesUnder(relativePath);
    }

    return [relativePath];
  });
}

function shouldInspectFile(filePath) {
  return (
    !ignoredPathParts.some((ignoredPart) => filePath.includes(ignoredPart)) &&
    /\.(js|mjs|ts|tsx|yml|yaml)$/.test(filePath)
  );
}

function findInlineRuntimePathBuilders(filePath) {
  const contents = fs.readFileSync(resolveRepoPath(filePath), "utf8");
  return contents
    .split("\n")
    .flatMap((line, index) =>
      inlineRuntimePathPattern.test(line)
        ? [{ filePath, lineNumber: index + 1, message: "inline runtime path builder", line }]
        : [],
    );
}

function findRetiredWssEndpoints(filePath) {
  const contents = fs.readFileSync(resolveRepoPath(filePath), "utf8");
  return contents
    .split("\n")
    .flatMap((line, index) =>
      retiredWssPattern.test(line) ? [{ filePath, lineNumber: index + 1, message: "retired wss endpoint", line }] : [],
    );
}

function validateProtocolSupportDocs() {
  const source = fs.readFileSync(resolveRepoPath(readmePath), "utf8");
  const normalizedSource = source.toLowerCase();
  return protocolSupportSnippets
    .filter((snippet) => !normalizedSource.includes(snippet.toLowerCase()))
    .map((snippet) => ({
      filePath: readmePath,
      message: `README missing protocol support snippet: ${snippet}`,
    }));
}

function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

function formatViolation(violation) {
  if (violation.lineNumber) {
    return `${violation.filePath}:${violation.lineNumber}: ${violation.message}: ${violation.line.trim()}`;
  }

  return `${violation.filePath}: ${violation.message}`;
}

main();
