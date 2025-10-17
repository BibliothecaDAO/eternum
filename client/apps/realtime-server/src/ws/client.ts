type ServerMessage =
  | { type: "connected"; playerId: string }
  | { type: "joined:zone"; zoneId: string }
  | { type: "left:zone"; zoneId: string }
  | { type: string; [key: string]: unknown };

type ClientMessage = { type: "join:zone"; zoneId: string } | { type: "leave:zone"; zoneId: string };

export interface RealtimeClientOptions {
  baseUrl: string;
  playerId: string;
  onOpen?(socket: WebSocket): void;
  onMessage?(message: ServerMessage, raw: MessageEvent): void;
  onClose?(event: CloseEvent): void;
  onError?(event: Event): void;
}

export class RealtimeClient {
  #socket: WebSocket;
  #options: RealtimeClientOptions;

  constructor(options: RealtimeClientOptions) {
    this.#options = options;
    this.#socket = this.#connect();
  }

  joinZone(zoneId: string) {
    this.#send({ type: "join:zone", zoneId });
  }

  leaveZone(zoneId: string) {
    this.#send({ type: "leave:zone", zoneId });
  }

  close() {
    this.#socket.close();
  }

  #connect() {
    const url = this.#buildWebSocketUrl();
    const socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      this.#options.onOpen?.(socket);
    });

    socket.addEventListener("message", (event) => {
      const message = this.#safeParse(event.data);
      if (message) {
        this.#options.onMessage?.(message, event);
      }
    });

    socket.addEventListener("close", (event) => {
      this.#options.onClose?.(event);
    });

    socket.addEventListener("error", (event) => {
      this.#options.onError?.(event);
    });

    return socket;
  }

  #buildWebSocketUrl() {
    const url = new URL(this.#options.baseUrl);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    }
    url.pathname = "/ws";
    url.searchParams.set("playerId", this.#options.playerId);
    return url.toString();
  }

  #safeParse(payload: unknown): ServerMessage | undefined {
    try {
      const message =
        typeof payload === "string"
          ? (JSON.parse(payload) as ServerMessage)
          : typeof payload === "object" && payload
            ? (payload as ServerMessage)
            : undefined;
      return message;
    } catch {
      return undefined;
    }
  }

  #send(message: ClientMessage) {
    if (this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(message));
    }
  }
}

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
