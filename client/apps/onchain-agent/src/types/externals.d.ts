/**
 * Ambient module declarations for workspace and local dependencies.
 *
 * These stubs allow TypeScript to resolve imports when the dependent
 * packages have not been built yet (no DTS output). Once `pnpm install`
 * and the package builds complete, the real types will take precedence.
 */

declare module "@bibliothecadao/client" {
  export class EternumClient {
    readonly view: any;
    readonly resources: any;
    readonly troops: any;
    readonly combat: any;
    readonly trade: any;
    readonly buildings: any;
    readonly bank: any;
    readonly hyperstructure: any;
    readonly guild: any;
    readonly realm: any;
    readonly cache: any;
    static create(config: any): Promise<EternumClient>;
    connect(account: any): void;
    disconnect(): void;
    get isConnected(): boolean;
    get provider(): any;
    get sql(): any;
  }

  export function computeStrength(count: number, tier: number): number;
  export function computeOutputAmount(
    amountIn: number,
    reserveIn: number,
    reserveOut: number,
    feeNum: number,
    feeDenom: number,
  ): number;
  export function computeBuildingCost(
    baseCosts: { resourceId: number; name: string; amount: number }[],
    existingCount: number,
    costPercentIncrease: number,
  ): { resourceId: number; name: string; amount: number }[];
  export function computeSlippage(amountIn: number, reserveIn: number, reserveOut: number): number;
  export function computeMarketPrice(reserveIn: number, reserveOut: number): number;
  export function computeStamina(params: any): any;
  export function computeBalance(params: any): any;
  export function computeDepletionTime(params: any): any;
  export function computeStaminaModifier(
    stamina: number,
    isAttacker: boolean,
    attackReq: number,
    defenseReq: number,
  ): number;
  export function computeCooldownModifier(
    cooldownEnd: number,
    currentTime: number,
    isAttacker: boolean,
  ): number;
}

declare module "@bibliothecadao/game-agent" {
  export interface WorldState<TEntity = unknown> {
    tick: number;
    timestamp: number;
    entities: TEntity[];
    resources?: Map<string, number>;
    raw?: unknown;
  }

  export interface GameAdapter<TState extends WorldState = WorldState> {
    getWorldState(): Promise<TState>;
    executeAction(action: GameAction): Promise<ActionResult>;
    simulateAction(action: GameAction): Promise<SimulationResult>;
    subscribe?(callback: (state: TState) => void): () => void;
  }

  export interface GameAction {
    type: string;
    params: Record<string, unknown>;
  }

  export interface ActionResult {
    success: boolean;
    txHash?: string;
    data?: unknown;
    error?: string;
  }

  export interface SimulationResult {
    success: boolean;
    outcome?: unknown;
    cost?: unknown;
    error?: string;
  }

  export interface GameAgentConfig<TState extends WorldState = WorldState> {
    adapter: GameAdapter<TState>;
    dataDir: string;
    model?: any;
    tickIntervalMs?: number;
  }

  export interface CreateGameAgentOptions<TState extends WorldState = WorldState> extends GameAgentConfig<TState> {
    streamFn?: any;
    includeDataTools?: boolean;
    extraTools?: any[];
    runtimeConfigManager?: RuntimeConfigManager;
  }

  export interface GameAgentResult {
    agent: import("@mariozechner/pi-agent-core").Agent;
    tools: any[];
    ticker: TickLoop;
    recorder: any;
    enqueuePrompt(prompt: string): Promise<void>;
    reloadPrompt(): void;
    setDataDir(dataDir: string): void;
    getDataDir(): string;
    dispose(): Promise<void>;
  }

  export interface TickLoop {
    start(): void;
    stop(): void;
    setIntervalMs(intervalMs: number): void;
    readonly intervalMs: number;
    readonly isRunning: boolean;
    readonly tickCount: number;
  }

  export interface RuntimeConfigChange {
    path: string;
    value: unknown;
  }

  export interface RuntimeConfigUpdateResult {
    path: string;
    applied: boolean;
    message: string;
  }

  export interface RuntimeConfigApplyResult {
    ok: boolean;
    results: RuntimeConfigUpdateResult[];
    currentConfig: Record<string, unknown>;
  }

  export interface RuntimeConfigManager {
    getConfig(): Record<string, unknown>;
    applyChanges(changes: RuntimeConfigChange[], reason?: string): Promise<RuntimeConfigApplyResult>;
  }

  export type HeartbeatJobMode = "observe" | "act";

  export interface HeartbeatJob {
    id: string;
    enabled: boolean;
    schedule: string;
    prompt: string;
    mode: HeartbeatJobMode;
    timeoutSec?: number;
  }

  export interface HeartbeatLoop {
    start(): void;
    stop(): void;
    setPollIntervalMs(intervalMs: number): void;
    readonly pollIntervalMs: number;
    readonly isRunning: boolean;
    readonly cycleCount: number;
  }

  export function parseHeartbeatConfig(markdown: string): { version: number; jobs: HeartbeatJob[] };
  export function cronMatchesDate(schedule: string, date: Date): boolean;
  export function createHeartbeatLoop(options: {
    getHeartbeatPath: () => string;
    onRun: (job: HeartbeatJob, context: { now: Date; scheduledFor: Date; minuteKey: string }) => Promise<void>;
    pollIntervalMs?: number;
    onError?: (error: Error) => void;
    now?: () => Date;
  }): HeartbeatLoop;

  export function createGameAgent<TState extends WorldState = WorldState>(
    options: CreateGameAgentOptions<TState>,
  ): GameAgentResult;

  export function formatTickPrompt(state: WorldState): string;
}

declare module "@mariozechner/pi-agent-core" {
  export interface AgentState {
    systemPrompt: string;
    model: any;
    thinkingLevel: string;
    tools: any[];
    messages: AgentMessage[];
    isStreaming: boolean;
    streamMessage: AgentMessage | null;
    pendingToolCalls: Set<string>;
    error?: string;
  }

  export type AgentMessage = any;

  export type AgentEvent =
    | { type: "agent_start" }
    | { type: "agent_end"; messages: AgentMessage[] }
    | { type: "turn_start" }
    | { type: "turn_end"; message: AgentMessage; toolResults: any[] }
    | { type: "message_start"; message: AgentMessage }
    | { type: "message_update"; message: AgentMessage; assistantMessageEvent: any }
    | { type: "message_end"; message: AgentMessage }
    | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
    | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
    | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };

  export interface AgentTool<TParameters = any, TDetails = any> {
    name: string;
    label: string;
    description: string;
    parameters: TParameters;
    execute: (toolCallId: string, params: any, signal?: AbortSignal, onUpdate?: any) => Promise<any>;
  }

  export class Agent {
    constructor(opts?: any);
    get state(): AgentState;
    subscribe(fn: (e: AgentEvent) => void): () => void;
    prompt(input: string | AgentMessage | AgentMessage[]): Promise<void>;
    steer(m: AgentMessage): void;
    followUp(m: AgentMessage): void;
    abort(): void;
    waitForIdle(): Promise<void>;
    reset(): void;
    setSystemPrompt(v: string): void;
    setModel(m: any): void;
    setTools(t: any[]): void;
  }
}

declare module "@mariozechner/pi-tui" {
  export interface Component {
    render(width: number): string[];
    handleInput?(data: string): void;
    invalidate(): void;
  }

  export interface Terminal {
    start(onInput: (data: string) => void, onResize: () => void): void;
    stop(): void;
    write(data: string): void;
    hideCursor(): void;
    showCursor(): void;
    readonly columns: number;
    readonly rows: number;
  }

  export class ProcessTerminal implements Terminal {
    start(onInput: (data: string) => void, onResize: () => void): void;
    stop(): void;
    write(data: string): void;
    hideCursor(): void;
    showCursor(): void;
    readonly columns: number;
    readonly rows: number;
  }

  export class Container implements Component {
    children: Component[];
    addChild(component: Component): void;
    removeChild(component: Component): void;
    clear(): void;
    invalidate(): void;
    render(width: number): string[];
  }

  export class TUI extends Container {
    terminal: Terminal;
    constructor(terminal: Terminal);
    start(): void;
    stop(): void;
    requestRender(force?: boolean): void;
    setFocus(component: Component | null): void;
    handleInput?(data: string): void;
  }

  export class Text implements Component {
    text: string;
    render(width: number): string[];
    invalidate(): void;
  }

  export class Markdown implements Component {
    markdown: string;
    render(width: number): string[];
    invalidate(): void;
  }

  export class Loader implements Component {
    text: string;
    render(width: number): string[];
    invalidate(): void;
  }
}

declare module "@mariozechner/pi-ai" {
  export interface Model<T = any> {
    api: string;
    provider: string;
    id: string;
    reasoning?: boolean;
  }

  export function getModel(provider: string, modelId: string): Model;
}
