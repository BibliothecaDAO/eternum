import { execSync } from "node:child_process";

const SKIP_GUARD = process.env.SKIP_THREE_CHANGED_GUARD === "1";
if (SKIP_GUARD) {
  console.log("[three-changed-guard] skipped via SKIP_THREE_CHANGED_GUARD=1");
  process.exit(0);
}

const BASE_REF = process.env.THREE_GUARD_BASE_REF ?? "HEAD~1";

const getChangedFiles = () => {
  const commands = [
    `git diff --name-only --diff-filter=ACMRTUXB ${BASE_REF}...HEAD`,
    "git diff --name-only --diff-filter=ACMRTUXB",
  ];

  for (const command of commands) {
    try {
      const output = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      // Try next command.
    }
  }

  return [];
};

const changedFiles = getChangedFiles();

const isThreeSourceFile = (file) =>
  file.startsWith("src/three/") &&
  (file.endsWith(".ts") || file.endsWith(".tsx")) &&
  !file.endsWith(".test.ts") &&
  !file.endsWith(".test.tsx") &&
  !file.includes("/__tests__/");

const isThreeTestFile = (file) =>
  file.startsWith("src/three/") &&
  (file.endsWith(".test.ts") || file.endsWith(".test.tsx") || file.includes("/__tests__/"));

const changedThreeSourceFiles = changedFiles.filter(isThreeSourceFile);
const changedThreeTestFiles = changedFiles.filter(isThreeTestFile);

if (changedThreeSourceFiles.length === 0) {
  console.log("[three-changed-guard] no src/three source changes detected");
  process.exit(0);
}

if (changedThreeTestFiles.length === 0) {
  console.error("[three-changed-guard] src/three source files changed without accompanying src/three tests:");
  changedThreeSourceFiles.forEach((file) => console.error(` - ${file}`));
  console.error("Add or update src/three tests, or run with SKIP_THREE_CHANGED_GUARD=1 to bypass intentionally.");
  process.exit(1);
}

console.log(
  `[three-changed-guard] ok (${changedThreeSourceFiles.length} source files, ${changedThreeTestFiles.length} test files)`,
);
