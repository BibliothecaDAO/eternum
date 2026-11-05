import { readFileSync, renameSync, writeFileSync } from "node:fs";

/** A phone's platform passkey: resident, user-verified, answered without a person at the prompt. */
const AUTHENTICATOR = {
  protocol: "ctap2",
  transport: "internal",
  hasResidentKey: true,
  hasUserVerification: true,
  isUserVerified: true,
  automaticPresenceSimulation: true,
};

/**
 * A player's saved passkeys on the run's page (DevTools' virtual authenticator, the credentials as a device of the
 * default wallet's dev test keeps them), so their Realms wallet confirms without a person. `save` writes the
 * credentials back to the same private file, with their sign counts as the page left them. The file is the only place
 * they are read from or written to: never the evidence, never a log.
 */
export async function restorePasskeys(devTools, file) {
  const saved = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(saved) || saved.length === 0) throw new Error(`${file} holds no passkey`);
  // WebAuthn refuses a page without focus; a headless page has none, a phone in the hand always has it.
  await devTools.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await devTools.send("WebAuthn.enable", { enableUI: false });
  const { authenticatorId } = await devTools.send("WebAuthn.addVirtualAuthenticator", { options: AUTHENTICATOR });
  for (const credential of saved) await devTools.send("WebAuthn.addCredential", { authenticatorId, credential });
  return {
    count: saved.length,
    save: async () => {
      const { credentials } = await devTools.send("WebAuthn.getCredentials", { authenticatorId });
      // Written whole, then moved over the file: a run stopped halfway never leaves it half written.
      writeFileSync(`${file}.next`, JSON.stringify(credentials), { mode: 0o600 });
      renameSync(`${file}.next`, file);
    },
  };
}
