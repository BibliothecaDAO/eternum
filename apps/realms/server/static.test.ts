import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serveStatic } from "./static";

let distDirectory: string;
let outsideFileName: string;

beforeAll(async () => {
  distDirectory = await mkdtemp(join(tmpdir(), "realms-identity-static-"));
  outsideFileName = `${basename(distDirectory)}-outside.txt`;
  await mkdir(join(distDirectory, "assets"));
  await writeFile(join(distDirectory, "index.html"), "<main>Realms</main>");
  await writeFile(join(distDirectory, "assets", "app.js"), "console.log('realms')");
  await writeFile(join(distDirectory, "..", outsideFileName), "must not be served");
});

afterAll(async () => {
  await rm(distDirectory, { recursive: true });
  await rm(join(distDirectory, "..", outsideFileName));
});

describe("serveStatic", () => {
  it("serves fingerprinted assets with immutable caching", async () => {
    const response = await serveStatic(new URL("https://app.realms.party/assets/app.js"), "GET", distDirectory);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public,max-age=31536000,immutable");
    await expect(response.text()).resolves.toBe("console.log('realms')");
  });

  it("falls back to the SPA shell without caching it", async () => {
    const response = await serveStatic(new URL("https://app.realms.party/profile/0x123"), "GET", distDirectory);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("max-age=0,must-revalidate");
    await expect(response.text()).resolves.toBe("<main>Realms</main>");
  });

  it("returns GET headers and no body for HEAD", async () => {
    const get = await serveStatic(new URL("https://app.realms.party/"), "GET", distDirectory);
    const head = await serveStatic(new URL("https://app.realms.party/"), "HEAD", distDirectory);

    expect(Object.fromEntries(head.headers)).toEqual(Object.fromEntries(get.headers));
    await expect(head.text()).resolves.toBe("");
  });

  it("does not serve a file outside the dist directory", async () => {
    const response = await serveStatic(
      new URL(`https://app.realms.party/%2e%2e%2f${outsideFileName}`),
      "GET",
      distDirectory,
    );

    await expect(response.text()).resolves.toBe("<main>Realms</main>");
  });
});
