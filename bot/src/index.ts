import { Hono } from "hono";
import { GatewayIntentBits } from "discord.js";
import users from "./routes/users";
import { SapphireClient } from "@sapphire/framework";
import * as torii from "@dojoengine/torii-wasm";
import { syncEntities } from "@dojoengine/state";
import { dojoConfig } from "../../client/dojoConfig";

import { createWorld } from "@dojoengine/recs";

export const world = createWorld();

import { defineContractComponents } from "../../client/src/dojo/contractComponents";

export const client = new SapphireClient({
  intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  loadMessageCommandListeners: true,
});

console.log(torii.createClient);

// const sync = await syncEntities(toriiClient, defineContractComponents(world) as any, []);

console.log("Logging in.....");

await client.login(process.env.DISCORD_TOKEN);

const app = new Hono();

export const routes = app.route("/users", users);

export const toriiClient = await torii.createClient({
  rpcUrl: dojoConfig.rpcUrl,
  toriiUrl: dojoConfig.toriiUrl,
  relayUrl: "",
  worldAddress: dojoConfig.manifest.world.address || "",
});

export type AppType = typeof routes;

export default {
  port: 7070,
  fetch: app.fetch,
};
