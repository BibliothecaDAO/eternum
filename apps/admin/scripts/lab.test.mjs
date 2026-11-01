import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
import { CAMPAIGNS } from "../../../packages/identity/src/campaigns.ts";

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

it("answers production's calendar with the Devcon season's dates from its campaign", async () => {
  const out = mkdtempSync(join(tmpdir(), "admin-lab-"));
  try {
    execFileSync("node", [new URL("./lab.mjs", import.meta.url).pathname, out]);
    const window = {};
    const location = { search: "?environment=production", href: "https://lab.invalid/" };
    runInNewContext(readFileSync(join(out, "fixtures.js"), "utf8"), {
      window,
      location,
      Response,
      URL,
      URLSearchParams,
    });
    const { calendar } = await (await window.fetch("/api/games")).json();
    const devcon = CAMPAIGNS["devcon-2026"];
    expect(calendar.value).toEqual([
      {
        phase: "frontier",
        presetId: 6,
        startsAt: new Date(devcon.startsAt * 1000).toISOString(),
        endsAt: new Date(devcon.redeemUntil * 1000).toISOString(),
      },
    ]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
