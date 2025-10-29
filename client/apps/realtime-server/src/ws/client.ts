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
  playerId,
  join,
  leave,
}: {
  baseUrl: string;
  playerId: string;
  join?: string[];
  leave?: string[];
}) => {
  const client = new RealtimeClient({
    baseUrl,
    playerId,
    onOpen: () => {
      console.log(`[ws] connected as ${playerId}`);
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
  const playerId = (args.player as string | undefined) ?? "demo-player";
  const joinZones = typeof args.join === "string" ? args.join.split(",") : undefined;
  const leaveZones = typeof args.leave === "string" ? args.leave.split(",") : undefined;

  if (args.help) {
    console.log(
      [
        "Realtime client usage:",
        "  bun run src/ws/client.ts --url http://localhost:4001 --player demo --join zone-1",
        "",
        "Flags:",
        "  --url    Base HTTP URL of the realtime server (default: http://localhost:4001)",
        "  --player Player identifier sent to the server (default: demo-player)",
        "  --join   Comma separated list of zones to join on connect",
        "  --leave  Comma separated list of zones to leave immediately after connect",
        "  --help   Show this message",
      ].join("\n"),
    );
    process.exit(0);
  }

  createLoggerClient({
    baseUrl,
    playerId,
    join: joinZones,
    leave: leaveZones,
  });
}
