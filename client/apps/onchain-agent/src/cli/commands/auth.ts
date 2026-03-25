/**
 * `axis auth` — authenticate with Cartridge and copy the login URL to clipboard.
 *
 * Lightweight: only runs config + world discovery + manifest + auth.
 * No game clients, no map, no automation.
 */

import type { Command } from "commander";
import { homedir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";

import { loadConfig } from "../../entry/config.js";
import { getManifest } from "../../auth/embedded-data.js";
import { discoverWorld, patchManifest } from "../../world/discovery.js";
import { getAccount } from "../../auth/session.js";

export function registerAuthCommand(program: Command) {
  program
    .command("auth")
    .description("Authenticate with Cartridge — copies login URL to clipboard")
    .action(async () => {
      const config = loadConfig();

      // Discover world if needed
      let contractsBySelector: Record<string, string> | undefined;
      if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
        console.log(`Discovering world "${config.worldName}" on ${config.chain}...`);
        const info = await discoverWorld(config.chain, config.worldName);
        config.toriiUrl = info.toriiUrl;
        config.worldAddress = info.worldAddress;
        config.rpcUrl = info.rpcUrl;
        contractsBySelector = info.contractsBySelector;
        config.dataDir = join(homedir(), ".axis", "worlds", info.worldAddress);
      }

      let manifest = getManifest(config.chain);
      if (contractsBySelector) {
        manifest = patchManifest(manifest, config.worldAddress, contractsBySelector);
      }

      // Intercept console.log to capture the auth URL
      let authUrl: string | null = null;
      const _origLog = console.log;
      console.log = (...a: any[]) => {
        const msg = a.map(String).join(" ");
        const urlMatch = msg.match(/https?:\/\/\S+/);
        if (urlMatch) {
          authUrl = urlMatch[0];
          exec(`echo ${JSON.stringify(authUrl)} | pbcopy`);
          _origLog("Auth URL copied to clipboard. Paste in your browser to login.");
          _origLog(authUrl);
        } else {
          _origLog(...a);
        }
      };

      const account = await getAccount({
        chain: config.chain,
        rpcUrl: config.rpcUrl,
        chainId: config.chainId,
        basePath: join(config.dataDir, ".cartridge"),
        manifest,
      });

      console.log = _origLog;

      if (!authUrl) {
        console.log(`Already authenticated. Account: ${account.address}`);
      }

      process.exit(0);
    });
}
