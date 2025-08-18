import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { ToriiClient } from "@dojoengine/torii-client";
import { withSpan, getCurrentTraceId, setSpanAttributes } from "../tracer";
import { reportNetworkError, addBreadcrumb } from "../errors/error-reporter";
import { Component, Metadata, Schema } from "@dojoengine/recs";

export class ToriiInstrumentation {
  private static instance: ToriiInstrumentation;
  private activeSubscriptions: Map<string, any> = new Map();
  private queryMetrics: Map<string, { count: number; totalDuration: number }> = new Map();

  private constructor() {}

  public static getInstance(): ToriiInstrumentation {
    if (!ToriiInstrumentation.instance) {
      ToriiInstrumentation.instance = new ToriiInstrumentation();
    }
    return ToriiInstrumentation.instance;
  }

  public instrumentToriiQuery<T>(
    queryName: string,
    queryParams: {
      client: ToriiClient;
      components?: Component<Schema, Metadata, undefined>[];
      clause?: any;
      models?: string[];
      limit?: number;
    },
    executeQuery: () => Promise<T>,
  ): Promise<T> {
    const spanName = `torii.query.${queryName}`;

    addBreadcrumb({
      type: "api",
      category: "torii",
      message: `Querying ${queryName}`,
      data: {
        models: queryParams.models,
        limit: queryParams.limit,
      },
    });

    return withSpan(
      spanName,
      async (span) => {
        span.setAttributes({
          "torii.query.name": queryName,
          "torii.query.models": queryParams.models?.join(",") || "",
          "torii.query.limit": queryParams.limit || 0,
          "torii.query.has_clause": !!queryParams.clause,
          "trace.id": getCurrentTraceId(),
        });

        const startTime = performance.now();

        try {
          const result = await executeQuery();
          const duration = performance.now() - startTime;

          // Update metrics
          this.updateQueryMetrics(queryName, duration);

          span.setAttributes({
            "torii.query.duration_ms": duration,
            "torii.query.success": true,
            "torii.query.result_count": this.getResultCount(result),
          });

          span.setStatus({ code: SpanStatusCode.OK });

          // Log slow queries
          if (duration > 500) {
            addBreadcrumb({
              type: "api",
              category: "torii",
              message: `Slow query: ${queryName} took ${duration.toFixed(2)}ms`,
              data: {
                duration,
                queryName,
                models: queryParams.models,
              },
            });
          }

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;

          span.setAttributes({
            "torii.query.duration_ms": duration,
            "torii.query.success": false,
            "torii.query.error": (error as Error).message,
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          reportNetworkError(error as Error, {
            url: "torii-query",
            method: "QUERY",
            duration,
          });

          addBreadcrumb({
            type: "api",
            category: "torii",
            message: `Query ${queryName} failed`,
            data: {
              error: (error as Error).message,
              duration,
              queryName,
            },
          });

          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        attributes: {
          component: "torii",
          "db.system": "torii",
          "db.operation": "query",
        },
      },
    );
  }

  public instrumentSubscription<T>(
    subscriptionName: string,
    subscriptionParams: {
      models?: string[];
      clause?: any;
    },
    setupSubscription: () => T,
    onData?: (data: any) => void,
    onError?: (error: Error) => void,
  ): T {
    const subscriptionId = `${subscriptionName}_${Date.now()}`;

    const span = withSpan(
      `torii.subscription.${subscriptionName}`,
      (span) => {
        span.setAttributes({
          "torii.subscription.name": subscriptionName,
          "torii.subscription.id": subscriptionId,
          "torii.subscription.models": subscriptionParams.models?.join(",") || "",
          "torii.subscription.has_clause": !!subscriptionParams.clause,
        });

        addBreadcrumb({
          type: "api",
          category: "torii",
          message: `Starting subscription: ${subscriptionName}`,
          data: {
            subscriptionId,
            models: subscriptionParams.models,
          },
        });

        try {
          const subscription = setupSubscription();

          // Store subscription info
          this.activeSubscriptions.set(subscriptionId, {
            name: subscriptionName,
            startTime: Date.now(),
            messageCount: 0,
            span,
          });

          span.setStatus({ code: SpanStatusCode.OK });

          // Don't end the span - it stays open for the subscription duration
          return subscription;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          span.end();

          reportNetworkError(error as Error, {
            url: "torii-subscription",
            method: "SUBSCRIBE",
          });

          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        attributes: {
          component: "torii",
          "messaging.system": "websocket",
          "messaging.destination": subscriptionName,
        },
      },
    );

    return span as unknown as T;
  }

  public recordSubscriptionMessage(subscriptionId: string, messageType: "data" | "error", data?: any): void {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) return;

    subscription.messageCount++;

    if (messageType === "data") {
      addBreadcrumb({
        type: "api",
        category: "torii",
        message: `Subscription ${subscription.name} received data`,
        data: {
          messageCount: subscription.messageCount,
          dataSize: JSON.stringify(data || {}).length,
        },
      });
    } else {
      addBreadcrumb({
        type: "api",
        category: "torii",
        message: `Subscription ${subscription.name} error`,
        data: {
          error: data,
          messageCount: subscription.messageCount,
        },
      });

      if (data instanceof Error) {
        reportNetworkError(data, {
          url: "torii-subscription",
          method: "MESSAGE",
        });
      }
    }
  }

  public closeSubscription(subscriptionId: string): void {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) return;

    const duration = Date.now() - subscription.startTime;

    if (subscription.span) {
      subscription.span.setAttributes({
        "torii.subscription.duration_ms": duration,
        "torii.subscription.message_count": subscription.messageCount,
        "torii.subscription.messages_per_second": subscription.messageCount / (duration / 1000),
      });
      subscription.span.end();
    }

    addBreadcrumb({
      type: "api",
      category: "torii",
      message: `Subscription ${subscription.name} closed`,
      data: {
        duration,
        messageCount: subscription.messageCount,
      },
    });

    this.activeSubscriptions.delete(subscriptionId);
  }

  public instrumentSQLQuery<T>(query: string, params?: any[], executeQuery: () => Promise<T>): Promise<T> {
    const queryType = this.extractQueryType(query);
    const spanName = `torii.sql.${queryType}`;

    return withSpan(
      spanName,
      async (span) => {
        span.setAttributes({
          "db.system": "torii",
          "db.statement": this.sanitizeQuery(query),
          "db.operation": queryType,
          "torii.sql.params_count": params?.length || 0,
        });

        const startTime = performance.now();

        try {
          const result = await executeQuery();
          const duration = performance.now() - startTime;

          span.setAttributes({
            "torii.sql.duration_ms": duration,
            "torii.sql.success": true,
            "torii.sql.row_count": this.getResultCount(result),
          });

          span.setStatus({ code: SpanStatusCode.OK });

          // Log slow SQL queries
          if (duration > 1000) {
            addBreadcrumb({
              type: "api",
              category: "torii",
              message: `Slow SQL query: ${queryType} took ${duration.toFixed(2)}ms`,
              data: {
                duration,
                queryType,
                query: this.sanitizeQuery(query).substring(0, 100),
              },
            });
          }

          return result;
        } catch (error) {
          const duration = performance.now() - startTime;

          span.setAttributes({
            "torii.sql.duration_ms": duration,
            "torii.sql.success": false,
            "torii.sql.error": (error as Error).message,
          });

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          reportNetworkError(error as Error, {
            url: "torii-sql",
            method: queryType,
            duration,
          });

          throw error;
        }
      },
      {
        kind: SpanKind.CLIENT,
        attributes: {
          component: "torii",
          "db.type": "sql",
        },
      },
    );
  }

  private updateQueryMetrics(queryName: string, duration: number): void {
    const existing = this.queryMetrics.get(queryName) || { count: 0, totalDuration: 0 };
    existing.count++;
    existing.totalDuration += duration;
    this.queryMetrics.set(queryName, existing);

    // Report metrics periodically
    if (existing.count % 100 === 0) {
      const avgDuration = existing.totalDuration / existing.count;
      setSpanAttributes({
        [`torii.metrics.${queryName}.avg_duration`]: avgDuration,
        [`torii.metrics.${queryName}.count`]: existing.count,
      });
    }
  }

  private getResultCount(result: any): number {
    if (!result) return 0;
    if (Array.isArray(result)) return result.length;
    if (result.entities && Array.isArray(result.entities)) return result.entities.length;
    if (result.data && Array.isArray(result.data)) return result.data.length;
    if (typeof result === "object") return Object.keys(result).length;
    return 1;
  }

  private extractQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    if (normalizedQuery.startsWith("SELECT")) return "SELECT";
    if (normalizedQuery.startsWith("INSERT")) return "INSERT";
    if (normalizedQuery.startsWith("UPDATE")) return "UPDATE";
    if (normalizedQuery.startsWith("DELETE")) return "DELETE";
    if (normalizedQuery.startsWith("CREATE")) return "CREATE";
    if (normalizedQuery.startsWith("DROP")) return "DROP";
    return "UNKNOWN";
  }

  private sanitizeQuery(query: string): string {
    // Remove potential sensitive data from queries
    return query
      .replace(/0x[a-fA-F0-9]+/g, "0x[HASH]") // Replace hex addresses
      .replace(/\b\d{10,}\b/g, "[NUMBER]") // Replace large numbers
      .replace(/'[^']*'/g, "'[STRING]'") // Replace string literals
      .substring(0, 500); // Limit length
  }

  public getMetrics(): Record<string, { avgDuration: number; count: number }> {
    const metrics: Record<string, { avgDuration: number; count: number }> = {};

    this.queryMetrics.forEach((value, key) => {
      metrics[key] = {
        avgDuration: value.totalDuration / value.count,
        count: value.count,
      };
    });

    return metrics;
  }
}

// Export singleton instance
export const toriiInstrumentation = ToriiInstrumentation.getInstance();

// Export convenience functions
export const instrumentToriiQuery = toriiInstrumentation.instrumentToriiQuery.bind(toriiInstrumentation);
export const instrumentSubscription = toriiInstrumentation.instrumentSubscription.bind(toriiInstrumentation);
export const instrumentSQLQuery = toriiInstrumentation.instrumentSQLQuery.bind(toriiInstrumentation);
