import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFileDirectionSource, createScriptedDirectionSource } from "./directions";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("direction sources", () => {
  it("hands out scripted directions in order, then waits until closed", async () => {
    const source = createScriptedDirectionSource(["first", "second"]);

    await expect(source.next()).resolves.toBe("first");
    await expect(source.next()).resolves.toBe("second");
    const pending = source.next();
    source.close();
    await expect(pending).resolves.toBeNull();
  });

  it("delivers a markdown file dropped into the directory once and moves it to done/", async () => {
    const directory = path.join(await mkdtemp(path.join(tmpdir(), "agent-directions-")), "directions");
    dirs.push(path.dirname(directory));
    const source = createFileDirectionSource(directory);

    const pending = source.next();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await writeFile(path.join(directory, "01-scout.md"), "Scout north.\n");

    await expect(pending).resolves.toBe("Scout north.");
    expect((await readdir(directory)).filter((name) => name.endsWith(".md"))).toEqual([]);
    expect(await readdir(path.join(directory, "done"))).toHaveLength(1);

    await writeFile(path.join(directory, "02-hold.md"), "Hold.\n");
    await expect(source.next()).resolves.toBe("Hold.");
    const closed = source.next();
    source.close();
    await expect(closed).resolves.toBeNull();
  });
});
