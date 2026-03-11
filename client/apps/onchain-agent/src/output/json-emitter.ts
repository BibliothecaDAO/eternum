type EventType =
  | "startup"
  | "tick"
  | "decision"
  | "action"
  | "heartbeat"
  | "prompt"
  | "session"
  | "config"
  | "error"
  | "shutdown";
type Verbosity = "quiet" | "actions" | "decisions" | "all";

interface AgentEvent {
  type: EventType;
  [key: string]: unknown;
}

// quiet: error, session, shutdown
// actions: + action
// decisions: + decision, heartbeat, prompt, startup
// all: + tick
const VERBOSITY_FILTER: Record<Verbosity, Set<EventType>> = {
  quiet: new Set(["error", "session", "shutdown"]),
  actions: new Set(["error", "session", "shutdown", "action"]),
  decisions: new Set([
    "error",
    "session",
    "shutdown",
    "action",
    "decision",
    "heartbeat",
    "prompt",
    "startup",
    "config",
  ]),
  all: new Set([
    "error",
    "session",
    "shutdown",
    "action",
    "decision",
    "heartbeat",
    "prompt",
    "startup",
    "config",
    "tick",
  ]),
};

type EventSubscriber = (event: AgentEvent) => void;

interface JsonEmitterOptions {
  verbosity: Verbosity;
  write: (line: string) => void;
}

export class JsonEmitter {
  private verbosity: Verbosity;
  private write: (line: string) => void;
  private subscribers: EventSubscriber[] = [];

  constructor(options: JsonEmitterOptions) {
    this.verbosity = options.verbosity;
    this.write = options.write;
  }

  emit(event: AgentEvent): void {
    const enriched = { ...event, ts: new Date().toISOString() };
    for (const sub of this.subscribers) {
      sub(enriched);
    }
    if (!VERBOSITY_FILTER[this.verbosity].has(event.type)) return;
    this.write(JSON.stringify(enriched));
  }

  subscribe(fn: EventSubscriber): () => void {
    this.subscribers.push(fn);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== fn);
    };
  }
}
