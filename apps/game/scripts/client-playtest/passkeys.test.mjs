import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { restorePasskeys } from "./passkeys.mjs";

/** The page's DevTools as the virtual authenticator answers it: what was sent, and the credentials it holds. */
const pageDevTools = () => {
  const sent = [];
  const held = [];
  return {
    sent,
    held,
    send: async (method, params) => {
      sent.push(method);
      if (method === "WebAuthn.addVirtualAuthenticator") return { authenticatorId: "auth-1" };
      if (method === "WebAuthn.addCredential") held.push({ ...params.credential });
      if (method === "WebAuthn.getCredentials") return { credentials: held };
      return {};
    },
  };
};

const savedPasskeys = (credentials) => {
  const file = join(mkdtempSync(join(tmpdir(), "passkeys-")), "passkeys.json");
  writeFileSync(file, JSON.stringify(credentials), { mode: 0o600 });
  return file;
};

describe("a player's saved passkeys", () => {
  it("are put on a focused page's authenticator, then written back with the sign counts the page left", async () => {
    const file = savedPasskeys([{ credentialId: "c1", rpId: "play.dev-realms.party", signCount: 3 }]);
    const devTools = pageDevTools();
    const passkeys = await restorePasskeys(devTools, file);
    expect(passkeys.count).toBe(1);
    expect(devTools.sent).toEqual([
      "Emulation.setFocusEmulationEnabled",
      "WebAuthn.enable",
      "WebAuthn.addVirtualAuthenticator",
      "WebAuthn.addCredential",
    ]);
    devTools.held[0].signCount = 5;
    await passkeys.save();
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual([
      { credentialId: "c1", rpId: "play.dev-realms.party", signCount: 5 },
    ]);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("refuse a file with no passkey before touching the page", async () => {
    const devTools = pageDevTools();
    await expect(restorePasskeys(devTools, savedPasskeys([]))).rejects.toThrow("holds no passkey");
    expect(devTools.sent).toEqual([]);
  });
});
