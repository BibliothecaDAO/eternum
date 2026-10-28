import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { classSizeReport as measureClasses } from "../../../utils/check-class-sizes.mjs";

export const classSizeReport = (directory, schema) =>
  measureClasses(directory, "world_native", [schema.games.contract, ...Object.values(schema.logicClasses)]);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL("../", import.meta.url);
  const schema = JSON.parse(await readFile(new URL("schema/schema.json", root), "utf8"));
  const report = await classSizeReport(fileURLToPath(new URL("target/dev/", root)), schema);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
}
