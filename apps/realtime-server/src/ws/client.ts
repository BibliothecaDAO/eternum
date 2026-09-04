import { RealtimeClient } from "@bibliothecadao/types";

const parseCliArgs = () => {
  const args = Bun.argv.slice(2);
  const options: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        options[key] = true;
      } else {
        options[key] = next;
        i += 1;
      }
    }
  }

  return options;
};

const createLoggerClient = ({
  baseUrl,
  join,
  leave,
  cookie,
  origin,
}: {
  baseUrl: string;
  join?: string[];
  leave?: string[];
  cookie: string;
  origin: string;
}) => {
  const client = new RealtimeClient({
    baseUrl,
    createSocket: (url) => new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } }),
    onOpen: () => {
      console.log("[ws] connected with verified session");
      join?.forEach((zoneId) => client.joinZone(zoneId));
      leave?.forEach((zoneId) => client.leaveZone(zoneId));
    },
    onMessage: (message) => {
      console.log("[ws] message", message);
    },
    onClose: (event) => {
      console.log(`[ws] closed ${event.code} ${event.reason}`);
    },
    onError: (event) => {
      console.error("[ws] error", event);
    },
  });

  return client;
};

if (import.meta.main) {
  const args = parseCliArgs();
  const baseUrl = (args.url as string | undefined) ?? "http://localhost:4001";
  const joinZones = typeof args.join === "string" ? args.join.split(",") : undefined;
  const leaveZones = typeof args.leave === "string" ? args.leave.split(",") : undefined;
  const cookie = (args.cookie as string | undefined) ?? process.env.REALTIME_SESSION_COOKIE;
  const origin = (args.origin as string | undefined) ?? process.env.REALTIME_ORIGIN;

  if (args.help) {
    console.log(
      [
        "Realtime client usage:",
        "  bun run src/ws/client.ts --url http://localhost:4001 --join game:1 --origin http://localhost:5173",
        "",
        "Flags:",
        "  --url    Base HTTP URL of the realtime server (default: http://localhost:4001)",
        "  --join   Comma separated list of game channels to join on connect",
        "  --leave  Comma separated list of game channels to leave immediately after connect",
        "  --cookie Better Auth Cookie header (or REALTIME_SESSION_COOKIE)",
        "  --origin Browser origin allowlisted by the server (or REALTIME_ORIGIN)",
        "  --help   Show this message",
      ].join("\n"),
    );
    process.exit(0);
  }

  if (!cookie) throw new Error("--cookie or REALTIME_SESSION_COOKIE is required");
  if (!origin) throw new Error("--origin or REALTIME_ORIGIN is required");

  createLoggerClient({
    baseUrl,
    join: joinZones,
    leave: leaveZones,
    cookie,
    origin,
  });
}
