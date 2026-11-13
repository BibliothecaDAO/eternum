import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assignWireIds, renderWireSerde } from "./wire-ids.mjs";

const root = new URL("../", import.meta.url);
const source = readFileSync(new URL("src/ownership.cairo", root), "utf8");
const body = /pub enum Story \{([\s\S]*?)^\}/m.exec(source)?.[1];
if (!body) throw new Error("Missing Story declaration");
const variants = [...body.matchAll(/^\s+(\w+)\s*([:,])/gm)].map(([, name, delimiter]) => ({
  name,
  type: delimiter === ":" ? "payload" : "()",
}));
const target = new URL("src/story_serde.cairo", root);
writeFileSync(
  target,
  `// Generated from the permanent wire registry and production Story ABI.\nuse crate::ownership::Story;\n\n${renderWireSerde("Story", assignWireIds("stories", variants))}`,
);
execFileSync("scarb", ["fmt", fileURLToPath(target)], { cwd: fileURLToPath(root), stdio: "inherit" });
