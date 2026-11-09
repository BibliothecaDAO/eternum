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
/**
 * The one stored credential: the Android app's Play upload key, read only by the job that signs its bundle, in the
 * android-upload environment that only next may use. Play App Signing holds the key installs trust and replaces a lost
 * or leaked upload key, so this key cannot publish to players by itself.
 */
const ANDROID_UPLOAD_KEY = {
  workflow: "workflows/android-app.yml",
  secrets: [
    "ANDROID_UPLOAD_KEYSTORE_BASE64",
    "ANDROID_UPLOAD_KEYSTORE_PASSWORD",
    "ANDROID_UPLOAD_KEY_ALIAS",
    "ANDROID_UPLOAD_KEY_PASSWORD",
  ],
};
const allowedSecrets = (path: string) => (path.endsWith(ANDROID_UPLOAD_KEY.workflow) ? ANDROID_UPLOAD_KEY.secrets : []);
test("every workflow and action uses only the built-in GitHub token, and the Android app's upload key", () => {
  for (const path of workflows(join(import.meta.dir, ".."))) {
    const source = readFileSync(path, "utf8");
    expect(
      storedSecretReads(source).filter((name) => !allowedSecrets(path).includes(name)),
      path,
    ).toEqual([]);
    expect(source, path).not.toMatch(/secrets:\s*inherit|toJSON\(\s*secrets\s*\)|secrets\s*\[\s*[^'"\s]/i);
  }
});
test("the secret check rejects dot and bracket reads, permitting only the built-in token", () => {
  expect(storedSecretReads("${{ secrets.GITHUB_TOKEN }} ${{ secrets['GITHUB_TOKEN'] }}")).toEqual([]);
  expect(storedSecretReads("${{ secrets.KEY }} ${{ secrets['OTHER'] }}")).toEqual(["KEY", "OTHER"]);
});
