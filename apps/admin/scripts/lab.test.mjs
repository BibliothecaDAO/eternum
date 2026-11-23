import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("writes the served page with the fixtures loaded before it, and can write it again", () => {
  const out = mkdtempSync(join(tmpdir(), "admin-lab-"));
  try {
    const script = new URL("./lab.mjs", import.meta.url).pathname;
    execFileSync("node", [script, out]);
    execFileSync("node", [script, out]);
    const page = readFileSync(join(out, "index.html"), "utf8");
    expect(page.match(/<script/g)).toHaveLength(2);
    expect(page.indexOf('src="fixtures.js"')).toBeLessThan(page.indexOf('src="admin.js"'));
    expect(readFileSync(join(out, "admin.js"), "utf8")).toBe(
      readFileSync(new URL("../public/admin.js", import.meta.url), "utf8"),
    );
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
