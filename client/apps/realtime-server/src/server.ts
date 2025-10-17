import "dotenv/config";

import { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { attachPlayerSession, requirePlayerSession, type AppEnv } from "./http/middleware/auth";
import directMessageRoutes from "./http/routes/direct-messages";
import notesRoutes from "./http/routes/notes";
import worldChatRoutes from "./http/routes/world-chat";
import { createZoneRegistry } from "./ws/zone-registry";

const { upgradeWebSocket, websocket } = createBunWebSocket();

const app = new Hono<AppEnv>();

const corsOrigins = (process.env.CORS_ORIGIN ?? "*").split(",");

app.use("*", logger());
app.use("*", attachPlayerSession);
app.use(
  "/api/*",
  cors({
    origin: corsOrigins,
    allowHeaders: ["*"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);
app.use(
  "/health",
  cors({
    origin: corsOrigins,
    allowHeaders: ["*"],
    allowMethods: ["GET"],
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ status: "ok" }));

app.route("/api/notes", notesRoutes);
app.route("/api/chat/world", worldChatRoutes);
app.route("/api/chat/dm", directMessageRoutes);

type ClientMessage = { type: "join:zone"; zoneId: string } | { type: "leave:zone"; zoneId: string };
const zoneRegistry = createZoneRegistry();

app.get(
  "/ws",
  requirePlayerSession,
  upgradeWebSocket((c) => {
    const session = c.get("playerSession");

    if (!session) {
      throw new Error("Player session missing for websocket connection");
    }

    return {
      onOpen(_event, ws) {
        ws.send(
          JSON.stringify({
            type: "connected",
            playerId: session.playerId,
          }),
        );
      },
      onMessage(event, ws) {
        try {
          const message = JSON.parse(event.data.toString()) as ClientMessage;

          if (message.type === "join:zone" && message.zoneId) {
            zoneRegistry.addSocketToZone(ws, message.zoneId);
            ws.send(
              JSON.stringify({
                type: "joined:zone",
                zoneId: message.zoneId,
              }),
            );
          }

          if (message.type === "leave:zone" && message.zoneId) {
            zoneRegistry.removeSocketFromZone(ws, message.zoneId);
            ws.send(
              JSON.stringify({
                type: "left:zone",
                zoneId: message.zoneId,
              }),
            );
          }
        } catch (error) {
          console.error("Failed to process websocket message", error);
        }
      },
      onClose(_event, ws) {
        zoneRegistry.removeSocketFromAllZones(ws);
      },
      onError(_event, ws) {
        zoneRegistry.removeSocketFromAllZones(ws);
      },
    };
  }),
);

const port = Number(process.env.PORT ?? 4001);

Bun.serve({
  port,
  fetch: app.fetch,
  websocket,
});

console.log(`Realtime server listening on port ${port}`);

export default app;
