import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import type { Connect, Plugin } from "vite";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
};

/** Local lab comparisons share their original URLs without becoming deployment assets. */
export function labArtwork(enabled: boolean): Plugin {
  let directory: string;
  const install = ({ middlewares }: { middlewares: Connect.Server }) => {
    if (enabled) middlewares.use("/lab", artwork(directory));
  };
  return {
    name: "lab-artwork",
    configResolved(config) {
      directory = resolve(config.root, "asset-sources/lab");
      if (config.publicDir && existsSync(resolve(config.publicDir, "lab")))
        throw new Error("Move lab artwork to asset-sources/lab; public files are deployed to players.");
    },
    configureServer: install,
    configurePreviewServer: install,
  };
}

function artwork(directory: string): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (request.method !== "GET" && request.method !== "HEAD") return next();
    let pathname: string;
    try {
      pathname = decodeURIComponent((request.url ?? "").split("?")[0]);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const file = resolve(directory, `.${pathname}`);
    if (!file.startsWith(`${directory}${sep}`) || pathname.includes("\0")) {
      response.writeHead(403).end();
      return;
    }
    const contentType = CONTENT_TYPES[extname(file)];
    if (!contentType) return next();
    void readFile(file).then(
      (bytes) => {
        response.setHeader("Content-Type", contentType);
        response.setHeader("Content-Length", bytes.length);
        response.setHeader("Cache-Control", "no-cache");
        response.end(request.method === "HEAD" ? undefined : bytes);
      },
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT" || error.code === "EISDIR") next();
        else next(error);
      },
    );
  };
}
