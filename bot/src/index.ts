import { Hono } from "hono";
import { GatewayIntentBits } from "discord.js";
import users from "./routes/users";
import { SapphireClient } from "@sapphire/framework";

export const client = new SapphireClient({
  intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  loadMessageCommandListeners: true,
});

console.log("Logging in.....");

await client.login(process.env.DISCORD_TOKEN);

const app = new Hono();

export const routes = app.route("/users", users);

export type AppType = typeof routes;

export default {
  port: 7070,
  fetch: app.fetch,
};
