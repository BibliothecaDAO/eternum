import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { shortString } from "starknet";

import type { StoredCartridgeSessionMaterial } from "../types";

export async function materializeCartridgeSessionFiles(input: {
  basePath?: string;
  material: StoredCartridgeSessionMaterial;
}): Promise<string> {
  const basePath = input.basePath ?? (await mkdtemp(join(tmpdir(), "agent-cartridge-session-")));
  await mkdir(basePath, { recursive: true });
  await writeFile(
    join(basePath, "session.json"),
    JSON.stringify(
      {
        signer: input.material.signer,
        session: input.material.session,
      },
      null,
      2,
    ),
    "utf8",
  );
  return basePath;
}

export async function validateStoredCartridgeSession(input: {
  rpcUrl: string;
  chainId: string;
  policies: Record<string, unknown>;
  material: StoredCartridgeSessionMaterial;
  basePath?: string;
}): Promise<{ accountAddress: string; username?: string }> {
  const basePath = await materializeCartridgeSessionFiles({
    basePath: input.basePath,
    material: input.material,
  });

  try {
    const { default: SessionProvider } = await import("@cartridge/controller/session/node");
    const provider = new SessionProvider({
      rpc: input.rpcUrl,
      chainId: shortString.encodeShortString(input.chainId),
      policies: input.policies as any,
      basePath,
    });
    const account = await provider.probe();
    if (!account) {
      throw new Error("Stored Cartridge session could not be restored.");
    }

    const username = await provider.username();
    return {
      accountAddress: account.address,
      username: typeof username === "string" ? username : undefined,
    };
  } finally {
    if (!input.basePath) {
      await rm(basePath, { recursive: true, force: true });
    }
  }
}
