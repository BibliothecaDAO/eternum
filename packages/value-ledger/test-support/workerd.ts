import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname } from "node:path";

/** Miniflare.dispose starts directory removal without awaiting it; finish it before the test process exits. */
export async function disposeWorker(
  worker:
    | {
        dispose(): Promise<void>;
        unsafeGetPersistPaths(): Map<string, string>;
      }
    | undefined,
): Promise<void> {
  if (!worker) return;
  const roots = new Set(
    [...worker.unsafeGetPersistPaths().values()]
      .map(dirname)
      .filter((root) => dirname(root) === tmpdir() && /^miniflare-[0-9a-f]+$/.test(basename(root))),
  );
  try {
    await worker.dispose();
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
}
