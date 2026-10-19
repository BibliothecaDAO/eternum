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
  await mkdir(join(root, "asset-sources/lab/rss-icons/history"), { recursive: true });
  await mkdir(join(root, "public"));
  await writeFile(join(root, "asset-sources/lab/rss-icons/history/stone.png"), original);
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
  return { root, original, config };
}

it.each(["dev", "preview"])("serves exact archived bytes only to the local %s lab", async (mode) => {
  const { root, original, config } = await fixture(true);
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
    expect((await fetch(`${origin}lab/%2e%2e%2Fprivate.png`)).status).toBe(403);
    expect((await fetch(`${origin}lab/%invalid.png`)).status).toBe(400);
    expect((await fetch(`${origin}lab/missing.png`, { headers: { Accept: "image/png" } })).status).toBe(404);
    expect((await fetch(`${origin}lab/kit/resource-icons`)).status).toBe(200);
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
