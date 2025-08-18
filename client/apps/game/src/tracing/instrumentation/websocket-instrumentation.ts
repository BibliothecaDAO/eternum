import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Socket } from "socket.io-client";
import { withSpan, startSpan, getCurrentTraceId } from "../tracer";
import { reportNetworkError, addBreadcrumb } from "../errors/error-reporter";

interface WebSocketMetrics {
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  connectTime?: number;
  disconnectTime?: number;
  reconnectCount: number;
  errorCount: number;
  latencySum: number;
  latencyCount: number;
}

export class WebSocketInstrumentation {
  private static instance: WebSocketInstrumentation;
  private socketMetrics: Map<string, WebSocketMetrics> = new Map();
  private activeSpans: Map<string, any> = new Map();
  private messageTimings: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): WebSocketInstrumentation {
    if (!WebSocketInstrumentation.instance) {
      WebSocketInstrumentation.instance = new WebSocketInstrumentation();
    }
    return WebSocketInstrumentation.instance;
  }

  public instrumentSocket(socket: Socket, socketName: string = "default"): Socket {
    const metrics: WebSocketMetrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      reconnectCount: 0,
      errorCount: 0,
      latencySum: 0,
      latencyCount: 0,
    };

    this.socketMetrics.set(socketName, metrics);

    // Instrument connection events
    this.instrumentConnectionEvents(socket, socketName, metrics);

    // Instrument message events
    this.instrumentMessageEvents(socket, socketName, metrics);

    // Instrument error events
    this.instrumentErrorEvents(socket, socketName, metrics);

    return socket;
  }

  private instrumentConnectionEvents(socket: Socket, socketName: string, metrics: WebSocketMetrics): void {
    const originalConnect = socket.connect.bind(socket);
    socket.connect = () => {
      const span = startSpan(`websocket.${socketName}.connect`, {
        kind: SpanKind.CLIENT,
        attributes: {
          "websocket.name": socketName,
          "websocket.url": socket.io.uri,
          "trace.id": getCurrentTraceId(),
        },
      });

      this.activeSpans.set(`${socketName}_connect`, span);
      metrics.connectTime = Date.now();

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} connecting`,
        data: {
          url: socket.io.uri,
        },
      });

      return originalConnect();
    };

    socket.on("connect", () => {
      const span = this.activeSpans.get(`${socketName}_connect`);
      if (span) {
        const duration = Date.now() - (metrics.connectTime || 0);
        span.setAttributes({
          "websocket.connect.duration_ms": duration,
          "websocket.connect.success": true,
          "websocket.id": socket.id,
        });
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
        this.activeSpans.delete(`${socketName}_connect`);
      }

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} connected`,
        data: {
          socketId: socket.id,
        },
      });
    });

    socket.on("disconnect", (reason: string) => {
      metrics.disconnectTime = Date.now();
      const sessionDuration = metrics.disconnectTime - (metrics.connectTime || 0);

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} disconnected`,
        data: {
          reason,
          sessionDuration,
          messagesReceived: metrics.messagesReceived,
          messagesSent: metrics.messagesSent,
        },
      });

      // Create span for disconnect event
      const span = startSpan(`websocket.${socketName}.disconnect`, {
        attributes: {
          "websocket.name": socketName,
          "websocket.disconnect.reason": reason,
          "websocket.session.duration_ms": sessionDuration,
          "websocket.session.messages_received": metrics.messagesReceived,
          "websocket.session.messages_sent": metrics.messagesSent,
        },
      });
      span.end();
    });

    socket.on("reconnect", (attemptNumber: number) => {
      metrics.reconnectCount++;

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} reconnected`,
        data: {
          attemptNumber,
          totalReconnects: metrics.reconnectCount,
        },
      });

      const span = startSpan(`websocket.${socketName}.reconnect`, {
        attributes: {
          "websocket.name": socketName,
          "websocket.reconnect.attempt": attemptNumber,
          "websocket.reconnect.total": metrics.reconnectCount,
        },
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });
  }

  private instrumentMessageEvents(socket: Socket, socketName: string, metrics: WebSocketMetrics): void {
    // Instrument emit (outgoing messages)
    const originalEmit = socket.emit.bind(socket);
    socket.emit = (event: string, ...args: any[]) => {
      const messageId = `${Date.now()}_${Math.random()}`;
      const data = args[0];
      const callback = typeof args[args.length - 1] === "function" ? args[args.length - 1] : null;

      metrics.messagesSent++;
      const messageSize = JSON.stringify(data || {}).length;
      metrics.bytesSent += messageSize;

      // Store timing for latency measurement if callback exists
      if (callback) {
        this.messageTimings.set(messageId, Date.now());
      }

      const span = startSpan(`websocket.${socketName}.send.${event}`, {
        kind: SpanKind.PRODUCER,
        attributes: {
          "websocket.name": socketName,
          "websocket.event": event,
          "websocket.message.size": messageSize,
          "websocket.message.id": messageId,
          "messaging.system": "websocket",
          "messaging.destination": event,
          "messaging.operation": "send",
        },
      });

      try {
        // Wrap callback to measure latency
        if (callback) {
          const wrappedCallback = (...callbackArgs: any[]) => {
            const latency = Date.now() - (this.messageTimings.get(messageId) || Date.now());
            metrics.latencySum += latency;
            metrics.latencyCount++;

            span.setAttributes({
              "websocket.message.latency_ms": latency,
            });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();

            this.messageTimings.delete(messageId);
            return callback(...callbackArgs);
          };

          const newArgs = [...args.slice(0, -1), wrappedCallback];
          return originalEmit(event, ...newArgs);
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return originalEmit(event, ...args);
        }
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        span.end();
        throw error;
      }
    };

    // Instrument incoming message handlers
    const originalOn = socket.on.bind(socket);
    socket.on = (event: string, handler: (...args: any[]) => void) => {
      const wrappedHandler = (...args: any[]) => {
        metrics.messagesReceived++;
        const messageSize = JSON.stringify(args[0] || {}).length;
        metrics.bytesReceived += messageSize;

        return withSpan(
          `websocket.${socketName}.receive.${event}`,
          () => {
            try {
              return handler(...args);
            } catch (error) {
              reportNetworkError(error as Error, {
                url: `websocket://${socketName}`,
                method: "RECEIVE",
              });
              throw error;
            }
          },
          {
            kind: SpanKind.CONSUMER,
            attributes: {
              "websocket.name": socketName,
              "websocket.event": event,
              "websocket.message.size": messageSize,
              "messaging.system": "websocket",
              "messaging.destination": event,
              "messaging.operation": "receive",
            },
          },
        );
      };

      return originalOn(event, wrappedHandler);
    };
  }

  private instrumentErrorEvents(socket: Socket, socketName: string, metrics: WebSocketMetrics): void {
    socket.on("connect_error", (error: Error) => {
      metrics.errorCount++;

      const span = this.activeSpans.get(`${socketName}_connect`);
      if (span) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.end();
        this.activeSpans.delete(`${socketName}_connect`);
      }

      reportNetworkError(error, {
        url: `websocket://${socketName}`,
        method: "CONNECT",
      });

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} connection error`,
        data: {
          error: error.message,
          errorCount: metrics.errorCount,
        },
      });
    });

    socket.on("error", (error: Error) => {
      metrics.errorCount++;

      reportNetworkError(error, {
        url: `websocket://${socketName}`,
        method: "UNKNOWN",
      });

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${socketName} error`,
        data: {
          error: error.message,
          errorCount: metrics.errorCount,
        },
      });
    });
  }

  public getMetrics(socketName: string = "default"): WebSocketMetrics | undefined {
    return this.socketMetrics.get(socketName);
  }

  public getAllMetrics(): Map<string, WebSocketMetrics> {
    return new Map(this.socketMetrics);
  }

  public getAverageLatency(socketName: string = "default"): number {
    const metrics = this.socketMetrics.get(socketName);
    if (!metrics || metrics.latencyCount === 0) return 0;
    return metrics.latencySum / metrics.latencyCount;
  }

  public resetMetrics(socketName: string = "default"): void {
    const metrics = this.socketMetrics.get(socketName);
    if (metrics) {
      metrics.messagesReceived = 0;
      metrics.messagesSent = 0;
      metrics.bytesReceived = 0;
      metrics.bytesSent = 0;
      metrics.errorCount = 0;
      metrics.latencySum = 0;
      metrics.latencyCount = 0;
    }
  }

  public instrumentCustomWebSocket<T extends WebSocket>(ws: T, wsName: string = "default"): T {
    const metrics: WebSocketMetrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      reconnectCount: 0,
      errorCount: 0,
      latencySum: 0,
      latencyCount: 0,
    };

    this.socketMetrics.set(wsName, metrics);

    // Track connection
    const connectSpan = startSpan(`websocket.${wsName}.connect`, {
      kind: SpanKind.CLIENT,
      attributes: {
        "websocket.name": wsName,
        "websocket.url": ws.url,
      },
    });

    metrics.connectTime = Date.now();

    ws.addEventListener("open", () => {
      connectSpan.setStatus({ code: SpanStatusCode.OK });
      connectSpan.end();

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${wsName} opened`,
        data: { url: ws.url },
      });
    });

    ws.addEventListener("close", (event) => {
      metrics.disconnectTime = Date.now();
      const sessionDuration = metrics.disconnectTime - (metrics.connectTime || 0);

      addBreadcrumb({
        type: "api",
        category: "websocket",
        message: `WebSocket ${wsName} closed`,
        data: {
          code: event.code,
          reason: event.reason,
          sessionDuration,
        },
      });
    });

    ws.addEventListener("error", () => {
      metrics.errorCount++;
      connectSpan.setStatus({ code: SpanStatusCode.ERROR });
      connectSpan.end();

      reportNetworkError(new Error("WebSocket error"), {
        url: ws.url,
        method: "WEBSOCKET",
      });
    });

    // Instrument send
    const originalSend = ws.send.bind(ws);
    ws.send = (data: string | ArrayBufferLike | Blob | ArrayBufferView) => {
      metrics.messagesSent++;
      const size = typeof data === "string" ? data.length : data.byteLength || 0;
      metrics.bytesSent += size;

      const span = startSpan(`websocket.${wsName}.send`, {
        kind: SpanKind.PRODUCER,
        attributes: {
          "websocket.name": wsName,
          "websocket.message.size": size,
        },
      });

      try {
        originalSend(data);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    };

    // Instrument message reception
    ws.addEventListener("message", (event) => {
      metrics.messagesReceived++;
      const size = event.data.length || 0;
      metrics.bytesReceived += size;

      const span = startSpan(`websocket.${wsName}.receive`, {
        kind: SpanKind.CONSUMER,
        attributes: {
          "websocket.name": wsName,
          "websocket.message.size": size,
        },
      });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
    });

    return ws;
  }
}

// Export singleton instance
export const webSocketInstrumentation = WebSocketInstrumentation.getInstance();

// Export convenience functions
export const instrumentSocket = webSocketInstrumentation.instrumentSocket.bind(webSocketInstrumentation);
export const instrumentCustomWebSocket =
  webSocketInstrumentation.instrumentCustomWebSocket.bind(webSocketInstrumentation);
export const getWebSocketMetrics = webSocketInstrumentation.getMetrics.bind(webSocketInstrumentation);
