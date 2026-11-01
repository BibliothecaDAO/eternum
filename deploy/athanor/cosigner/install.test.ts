import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The real install script under a temporary root. Stand-ins replace the privileged and networked commands; `git`
// keeps the checkout's revision in .git/HEAD and fails the step named in FAIL. The real key initializer is
// main.test.ts's; this stand-in keeps an existing key the same way.
const script = new URL("./install.sh", import.meta.url).pathname;
const OLD = "a".repeat(40);
const NEW = "b".repeat(40);
const STANDINS: Record<string, string> = {
  sudo: `while [ "$1" = -n ] || [ "$1" = -u ]; do [ "$1" = -u ] && shift; shift; done; exec "$@"`,
  useradd: "exit 0",
  id: `[ "$1" = payout-cosigner ] && exit 0; exec /usr/bin/id "$@"`,
  install: `dir=; while [ $# -gt 2 ] || [ "\${1#-}" != "$1" ]; do case "$1" in -d) dir=1; shift;; -m|-o|-g) shift 2;; *) break;; esac; done
if [ -n "$dir" ]; then mkdir -p "$1"; else cp "$1" "$2"; fi`,
  git: `[ "$1" = -C ] && { repo=$2; shift 2; }; echo "$*" >> "$PAYOUT_COSIGNER_ROOT/calls"
case "$1" in
  clone) mkdir -p "$4/.git";;
  fetch) [ "$FAIL" = fetch ] && exit 1;;
  checkout) [ "$FAIL" = checkout ] && exit 1; [ "$FAIL" = stays ] || echo "$3" > "$repo/.git/HEAD";;
  rev-parse) cat "$repo/.git/HEAD";;
esac
exit 0`,
  pnpm: `echo "pnpm $*" >> "$PAYOUT_COSIGNER_ROOT/calls"`,
};
const BUN = `key=$3; [ -f "$key" ] || echo "0xnew" > "$key"; echo "{\\"publicKey\\":\\"pk-$(cat "$key")\\"}"`;

let root: string, bin: string, home: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "cosigner-install-"));
  bin = join(root, "standins");
  home = join(root, "home");
  for (const path of [bin, join(home, ".bun/bin"), join(root, "var/log"), join(root, "usr/local/bin")])
    mkdirSync(path, { recursive: true });
  for (const [name, body] of Object.entries(STANDINS)) stub(join(bin, name), body);
  stub(join(home, ".bun/bin/bun"), BUN);
  // An existing installation at the old revision, with its key.
  mkdirSync(join(root, "opt/eternum/.git"), { recursive: true });
  writeFileSync(join(root, "opt/eternum/.git/HEAD"), `${OLD}\n`);
  mkdirSync(join(root, "etc/payout-cosigner"), { recursive: true });
  writeFileSync(join(root, "etc/payout-cosigner/key"), "0xkept\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function stub(path: string, body: string) {
  writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path, 0o755);
}
function prepare(fail = "") {
  const run = Bun.spawnSync(["bash", script, "prepare", NEW], {
    env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, PAYOUT_COSIGNER_ROOT: root, FAIL: fail },
  });
  return { code: run.exitCode, stdout: run.stdout.toString(), stderr: run.stderr.toString() };
}
const head = () => readFileSync(join(root, "opt/eternum/.git/HEAD"), "utf8").trim();
const calls = () => (existsSync(join(root, "calls")) ? readFileSync(join(root, "calls"), "utf8") : "");

test.each([
  ["fetch", "Co-signer install failed at: git -C"],
  ["checkout", "Co-signer install failed at: git -C"],
  ["stays", "is not at"],
])("an update whose %s fails stops before building, keeps no success and prints no key", (fail, message) => {
  const run = prepare(fail);
  expect(run.code).not.toBe(0);
  expect(run.stderr).toContain(message);
  expect(run.stdout).toBe("");
  expect(head()).toBe(OLD);
  expect(calls()).not.toContain("pnpm");
});

test("a retry after a failed update installs the requested revision, builds it and keeps the key", () => {
  expect(prepare("fetch").code).not.toBe(0);
  const run = prepare();
  expect(run.code).toBe(0);
  expect(JSON.parse(run.stdout)).toEqual({ publicKey: "pk-0xkept" });
  expect(head()).toBe(NEW);
  expect(calls()).toContain(`pnpm --dir ${root}/opt/eternum install --frozen-lockfile`);
  expect(calls()).toContain(`pnpm --dir ${root}/opt/eternum run build:packages`);
  expect(readFileSync(join(root, "etc/payout-cosigner/key"), "utf8")).toBe("0xkept\n");
});
