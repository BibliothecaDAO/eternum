// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, createServer, preview, type InlineConfig } from "vite";
import { expect, it } from "vitest";
import { labArtwork } from "./lab-artwork";

async function fixture(enabled: boolean) {
  const root = await mkdtemp(join(tmpdir(), "lab-artwork-"));
  const original = await readFile(new URL("../asset-sources/lab/rss-icons/history/stone.png", import.meta.url));
  const model = await readFile(new URL("../public/models/frontier/beast-wyvern.glb", import.meta.url));
  await mkdir(join(root, "asset-sources/lab/rss-icons/history"), { recursive: true });
  await mkdir(join(root, "asset-sources/lab/frontier-beasts"), { recursive: true });
  await mkdir(join(root, "public"));
  await writeFile(join(root, "asset-sources/lab/rss-icons/history/stone.png"), original);
  await writeFile(join(root, "asset-sources/lab/frontier-beasts/beast-wyvern.glb"), model);
  await writeFile(join(root, "asset-sources/lab/frontier-beasts/wyvern.blend"), "editable source");
  await writeFile(join(root, "asset-sources/private.png"), "private master");
  await writeFile(join(root, "public/shipped.png"), original);
  await writeFile(join(root, "index.html"), "<h1>Lab artwork</h1>");
  const config: InlineConfig = {
    root,
    configFile: false,
    envFile: false,
    logLevel: "silent",
    plugins: [labArtwork(enabled)],
    server: { host: "127.0.0.1", port: 0, watch: null },
    preview: { host: "127.0.0.1", port: 0 },
  };
  return { root, original, model, config };
}

it.each(["dev", "preview"])("serves lab pages and exact archived bytes in local %s", async (mode) => {
  const { root, original, model, config } = await fixture(true);
  const server =
    mode === "dev" ? await createServer(config).then((server) => server.listen()) : await previewAfterBuild(config);
  try {
    const origin = server.resolvedUrls!.local[0];
    const url = `${origin}lab/rss-icons/history/stone.png`;
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(original);
    const head = await fetch(url, { method: "HEAD" });
    expect(head.headers.get("Content-Length")).toBe(String(original.length));
    expect(await head.text()).toBe("");
    const glb = await fetch(`${origin}lab/frontier-beasts/beast-wyvern.glb`);
    expect(glb.status).toBe(200);
    expect(glb.headers.get("Content-Type")).toBe("model/gltf-binary");
    expect(Buffer.from(await glb.arrayBuffer())).toEqual(model);
    expect(
      (await fetch(`${origin}lab/frontier-beasts/wyvern.blend`, { headers: { Accept: "application/octet-stream" } }))
        .status,
    ).toBe(404);
    expect((await fetch(`${origin}lab/%2e%2e%2Fprivate.png`)).status).toBe(403);
    expect((await fetch(`${origin}lab/%invalid.png`)).status).toBe(400);
    expect((await fetch(`${origin}lab/missing.png`, { headers: { Accept: "image/png" } })).status).toBe(404);
    for (const path of ["lab", "lab/", "lab?capture=1", "lab/?capture=1", "lab/kit/resource-icons"]) {
      for (const method of ["GET", "HEAD"]) {
        const page = await fetch(`${origin}${path}`, { method });
        expect(page.status, `${method} /${path}`).toBe(200);
        expect(page.headers.get("Content-Type")).toContain("text/html");
        const body = await page.text();
        if (method === "GET") expect(body).toContain("<h1>Lab artwork</h1>");
        else expect(body).toBe("");
      }
    }
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
});

it("builds only shipped files and never serves the archive in a production preview", async () => {
  const { root, original, config } = await fixture(false);
  const server = await previewAfterBuild(config);
  try {
    await expect(readFile(join(root, "dist/lab/rss-icons/history/stone.png"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(await readFile(join(root, "dist/shipped.png"))).toEqual(original);
    const response = await fetch(`${server.resolvedUrls!.local[0]}lab/rss-icons/history/stone.png`, {
      headers: { Accept: "image/png" },
    });
    expect(response.status).toBe(404);
    await expect(readFile(join(root, "dist/lab/frontier-beasts/beast-wyvern.glb"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(
      (
        await fetch(`${server.resolvedUrls!.local[0]}lab/frontier-beasts/beast-wyvern.glb`, {
          headers: { Accept: "model/gltf-binary" },
        })
      ).status,
    ).toBe(404);
  } finally {
    await close(server);
    await rm(root, { recursive: true, force: true });
  }
});

it("refuses a new public lab archive before it can be copied into a build", async () => {
  const { root, config } = await fixture(false);
  try {
    await mkdir(join(root, "public/lab"));
    await writeFile(join(root, "public/lab/master.png"), "misplaced master");
    await expect(build(config)).rejects.toThrow("Move lab artwork to asset-sources/lab");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function previewAfterBuild(config: InlineConfig) {
  await build(config);
  return preview(config);
}

async function close(server: Awaited<ReturnType<typeof createServer>> | Awaited<ReturnType<typeof preview>>) {
  if ("close" in server) await server.close();
  else
    await new Promise<void>((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
}
