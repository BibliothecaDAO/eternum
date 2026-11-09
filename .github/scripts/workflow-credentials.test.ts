import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function workflows(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? workflows(path) : /\.ya?ml$/.test(path) ? [path] : [];
  });
}
function storedSecretReads(source: string) {
  return [...source.matchAll(/\bsecrets\s*(?:\.\s*([\w]+)|\[\s*['"]([^'"]+)['"]\s*\])/g)]
    .map((match) => match[1] ?? match[2])
    .filter((name) => name !== "GITHUB_TOKEN");
}
test("every workflow and action uses only the built-in GitHub token", () => {
  for (const path of workflows(join(import.meta.dir, ".."))) {
    const source = readFileSync(path, "utf8");
    expect(storedSecretReads(source), path).toEqual([]);
    expect(source, path).not.toMatch(/secrets:\s*inherit|toJSON\(\s*secrets\s*\)|secrets\s*\[\s*[^'"\s]/i);
  }
});
test("the secret check rejects dot and bracket reads, permitting only the built-in token", () => {
  expect(storedSecretReads("${{ secrets.GITHUB_TOKEN }} ${{ secrets['GITHUB_TOKEN'] }}")).toEqual([]);
  expect(storedSecretReads("${{ secrets.KEY }} ${{ secrets['OTHER'] }}")).toEqual(["KEY", "OTHER"]);
});
