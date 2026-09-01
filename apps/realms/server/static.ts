import { readFile, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

const DIST_DIRECTORY = resolve(import.meta.dirname, "../dist");
const INDEX_FILE = "index.html";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function serveStatic(url: URL, method: "GET" | "HEAD", distDirectory = DIST_DIRECTORY): Promise<Response> {
  const filePath = await resolveStaticFile(url, distDirectory);
  if (!filePath) {
    return new Response("Realms identity SPA has not been built", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const fileStats = await stat(filePath);
  const cacheControl = isFingerprintAsset(filePath, distDirectory)
    ? "public,max-age=31536000,immutable"
    : "max-age=0,must-revalidate";
  const headers = new Headers({
    "cache-control": cacheControl,
    "content-length": String(fileStats.size),
    "content-type": CONTENT_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
  });

  return new Response(method === "HEAD" ? null : await readFile(filePath), { headers });
}

function isFingerprintAsset(filePath: string, distDirectory: string): boolean {
  const relativePath = relative(resolve(distDirectory), filePath);
  return relativePath === "assets" || relativePath.startsWith(`assets${sep}`);
}

async function resolveStaticFile(url: URL, distDirectory: string): Promise<string | null> {
  const root = resolve(distDirectory);
  const index = resolve(root, INDEX_FILE);
  const requested = resolveRequestedPath(url, root);

  if (requested && (await isFile(requested))) return requested;
  return (await isFile(index)) ? index : null;
}

function resolveRequestedPath(url: URL, root: string): string | null {
  try {
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const requested = resolve(root, pathname);
    return requested === root || requested.startsWith(`${root}${sep}`) ? requested : null;
  } catch {
    return null;
  }
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
