import { context, trace, Context } from "@opentelemetry/api";
import { v4 as uuidv4 } from "uuid";

interface TraceContext {
  traceId: string;
  spanId?: string;
  userId?: string;
  sessionId: string;
  realmId?: string;
  gamePhase?: "early" | "mid" | "late";
  serverShard?: string;
  clientVersion: string;
  platform: string;
  device: {
    type: "desktop" | "mobile" | "tablet";
    os: string;
    browser: string;
  };
  network: {
    type: string;
    effectiveType: string;
    rtt: number;
    downlink: number;
  };
}

class TraceContextManager {
  private static instance: TraceContextManager;
  private currentContext: TraceContext;
  private contextStack: TraceContext[] = [];
  private userActions: Array<{ timestamp: number; action: string; data?: any }> = [];
  private maxUserActions = 100;

  private constructor() {
    this.currentContext = this.initializeContext();
    this.setupNetworkMonitoring();
  }

  public static getInstance(): TraceContextManager {
    if (!TraceContextManager.instance) {
      TraceContextManager.instance = new TraceContextManager();
    }
    return TraceContextManager.instance;
  }

  private initializeContext(): TraceContext {
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    return {
      traceId: this.generateTraceId(),
      sessionId: this.getOrCreateSessionId(),
      clientVersion: import.meta.env.VITE_PUBLIC_GAME_VERSION || "0.0.1",
      platform: "web",
      device: this.getDeviceInfo(),
      network: {
        type: connection?.type || "unknown",
        effectiveType: connection?.effectiveType || "unknown",
        rtt: connection?.rtt || 0,
        downlink: connection?.downlink || 0,
      },
    };
  }

  private generateTraceId(): string {
    // Generate OpenTelemetry compatible trace ID (32 hex characters)
    return uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "").substring(0, 16);
  }

  private getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem("eternum_session_id");
    if (stored) return stored;

    const sessionId = uuidv4();
    sessionStorage.setItem("eternum_session_id", sessionId);
    return sessionId;
  }

  private getDeviceInfo(): TraceContext["device"] {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    // Detect device type
    let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
    if (/Mobile|Android|iPhone/i.test(userAgent)) {
      deviceType = "mobile";
    } else if (/iPad|Tablet/i.test(userAgent)) {
      deviceType = "tablet";
    }

    // Detect OS
    let os = "Unknown";
    if (/Windows/i.test(platform)) os = "Windows";
    else if (/Mac/i.test(platform)) os = "macOS";
    else if (/Linux/i.test(platform)) os = "Linux";
    else if (/Android/i.test(userAgent)) os = "Android";
    else if (/iOS|iPhone|iPad/i.test(userAgent)) os = "iOS";

    // Detect browser
    let browser = "Unknown";
    if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) browser = "Chrome";
    else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = "Safari";
    else if (/Firefox/i.test(userAgent)) browser = "Firefox";
    else if (/Edge/i.test(userAgent)) browser = "Edge";

    return { type: deviceType, os, browser };
  }

  private setupNetworkMonitoring(): void {
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener("change", () => {
        this.currentContext.network = {
          type: connection.type || "unknown",
          effectiveType: connection.effectiveType || "unknown",
          rtt: connection.rtt || 0,
          downlink: connection.downlink || 0,
        };
      });
    }
  }

  public setUserId(userId: string): void {
    this.currentContext.userId = userId;
    this.propagateContext();
  }

  public setRealmId(realmId: string): void {
    this.currentContext.realmId = realmId;
    this.propagateContext();
  }

  public setGamePhase(phase: "early" | "mid" | "late"): void {
    this.currentContext.gamePhase = phase;
    this.propagateContext();
  }

  public setServerShard(shard: string): void {
    this.currentContext.serverShard = shard;
    this.propagateContext();
  }

  public recordUserAction(action: string, data?: any): void {
    this.userActions.push({
      timestamp: Date.now(),
      action,
      data,
    });

    // Trim if exceeding max
    if (this.userActions.length > this.maxUserActions) {
      this.userActions = this.userActions.slice(-this.maxUserActions);
    }
  }

  public getContext(): TraceContext {
    const span = trace.getSpan(context.active());
    return {
      ...this.currentContext,
      traceId: span?.spanContext().traceId || this.currentContext.traceId,
      spanId: span?.spanContext().spanId,
    };
  }

  public pushContext(updates: Partial<TraceContext>): void {
    this.contextStack.push({ ...this.currentContext });
    this.currentContext = { ...this.currentContext, ...updates };
    this.propagateContext();
  }

  public popContext(): void {
    const previous = this.contextStack.pop();
    if (previous) {
      this.currentContext = previous;
      this.propagateContext();
    }
  }

  private propagateContext(): void {
    const span = trace.getSpan(context.active());
    if (span) {
      span.setAttributes({
        "user.id": this.currentContext.userId || "anonymous",
        "session.id": this.currentContext.sessionId,
        "realm.id": this.currentContext.realmId || "none",
        "game.phase": this.currentContext.gamePhase || "unknown",
        "server.shard": this.currentContext.serverShard || "default",
        "client.version": this.currentContext.clientVersion,
        "device.type": this.currentContext.device.type,
        "device.os": this.currentContext.device.os,
        "device.browser": this.currentContext.device.browser,
        "network.type": this.currentContext.network.type,
        "network.effective_type": this.currentContext.network.effectiveType,
        "network.rtt": this.currentContext.network.rtt,
      });
    }
  }

  public enrichError(error: Error): Error & { context: TraceContext } {
    const enriched = error as Error & { context: TraceContext };
    enriched.context = this.getContext();
    return enriched;
  }

  public getCorrelationHeaders(): Record<string, string> {
    const span = trace.getSpan(context.active());
    const traceId = span?.spanContext().traceId || this.currentContext.traceId;
    const spanId = span?.spanContext().spanId || "";

    return {
      "X-Trace-Id": traceId,
      "X-Span-Id": spanId,
      "X-Session-Id": this.currentContext.sessionId,
      "X-User-Id": this.currentContext.userId || "anonymous",
      "X-Realm-Id": this.currentContext.realmId || "",
      "X-Client-Version": this.currentContext.clientVersion,
    };
  }

  public createChildContext(name: string, attributes?: Record<string, any>): Context {
    const span = trace.getTracer("eternum-game").startSpan(name, {
      attributes: {
        ...attributes,
        "parent.trace_id": this.currentContext.traceId,
        "session.id": this.currentContext.sessionId,
      },
    });

    return trace.setSpan(context.active(), span);
  }

  public getUserActions(limit?: number): Array<{ timestamp: number; action: string; data?: any }> {
    const actions = [...this.userActions];
    if (limit) {
      return actions.slice(-limit);
    }
    return actions;
  }

  public clearUserActions(): void {
    this.userActions = [];
  }

  public reset(): void {
    this.currentContext = this.initializeContext();
    this.contextStack = [];
    this.userActions = [];
  }

  public serialize(): string {
    return JSON.stringify({
      context: this.currentContext,
      userActions: this.userActions.slice(-20), // Last 20 actions
      timestamp: Date.now(),
    });
  }

  public deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      if (parsed.context) {
        this.currentContext = { ...this.currentContext, ...parsed.context };
      }
      if (parsed.userActions) {
        this.userActions = parsed.userActions;
      }
    } catch (error) {
      console.error("Failed to deserialize trace context:", error);
    }
  }
}

// Export singleton instance
export const traceContextManager = TraceContextManager.getInstance();

// Export convenience functions
export const getTraceContext = traceContextManager.getContext.bind(traceContextManager);
export const setUserId = traceContextManager.setUserId.bind(traceContextManager);
export const setRealmId = traceContextManager.setRealmId.bind(traceContextManager);
export const setGamePhase = traceContextManager.setGamePhase.bind(traceContextManager);
export const recordUserAction = traceContextManager.recordUserAction.bind(traceContextManager);
export const getCorrelationHeaders = traceContextManager.getCorrelationHeaders.bind(traceContextManager);
export const enrichError = traceContextManager.enrichError.bind(traceContextManager);
