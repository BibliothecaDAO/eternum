import React, { useEffect, useRef, ComponentType, ReactNode } from "react";
import { SpanKind } from "@opentelemetry/api";
import { withSpan, startSpan, getCurrentTraceId } from "../tracer";
import { addBreadcrumb, reportError } from "../errors/error-reporter";

interface ComponentMetrics {
  renderCount: number;
  totalRenderTime: number;
  lastRenderTime: number;
  mountTime?: number;
  unmountTime?: number;
  errorCount: number;
}

class ReactInstrumentation {
  private static instance: ReactInstrumentation;
  private componentMetrics: Map<string, ComponentMetrics> = new Map();
  private renderThreshold = 16; // 16ms = 60fps

  private constructor() {}

  public static getInstance(): ReactInstrumentation {
    if (!ReactInstrumentation.instance) {
      ReactInstrumentation.instance = new ReactInstrumentation();
    }
    return ReactInstrumentation.instance;
  }

  public traceComponent<P extends object>(Component: ComponentType<P>, componentName?: string): ComponentType<P> {
    const displayName = componentName || Component.displayName || Component.name || "Component";

    const TracedComponent: ComponentType<P> = (props: P) => {
      const renderStartRef = useRef<number>(0);
      const spanRef = useRef<any>(null);
      const metricsRef = useRef<ComponentMetrics>({
        renderCount: 0,
        totalRenderTime: 0,
        lastRenderTime: 0,
        errorCount: 0,
      });

      // Track mount
      useEffect(() => {
        const mountSpan = startSpan(`react.${displayName}.mount`, {
          kind: SpanKind.INTERNAL,
          attributes: {
            "react.component": displayName,
            "react.lifecycle": "mount",
            "trace.id": getCurrentTraceId(),
          },
        });

        metricsRef.current.mountTime = Date.now();
        this.componentMetrics.set(displayName, metricsRef.current);

        addBreadcrumb({
          type: "navigation",
          category: "react",
          message: `Component ${displayName} mounted`,
          data: {
            component: displayName,
          },
        });

        mountSpan.end();

        // Track unmount
        return () => {
          const unmountSpan = startSpan(`react.${displayName}.unmount`, {
            kind: SpanKind.INTERNAL,
            attributes: {
              "react.component": displayName,
              "react.lifecycle": "unmount",
              "react.component.lifetime_ms": Date.now() - (metricsRef.current.mountTime || 0),
              "react.component.render_count": metricsRef.current.renderCount,
              "react.component.avg_render_time":
                metricsRef.current.renderCount > 0
                  ? metricsRef.current.totalRenderTime / metricsRef.current.renderCount
                  : 0,
            },
          });

          metricsRef.current.unmountTime = Date.now();

          addBreadcrumb({
            type: "navigation",
            category: "react",
            message: `Component ${displayName} unmounted`,
            data: {
              component: displayName,
              lifetime: Date.now() - (metricsRef.current.mountTime || 0),
              renderCount: metricsRef.current.renderCount,
            },
          });

          unmountSpan.end();
          this.componentMetrics.delete(displayName);
        };
      }, []);

      // Track renders
      useEffect(() => {
        const renderTime = performance.now() - renderStartRef.current;
        metricsRef.current.renderCount++;
        metricsRef.current.totalRenderTime += renderTime;
        metricsRef.current.lastRenderTime = renderTime;

        if (spanRef.current) {
          spanRef.current.setAttributes({
            "react.render.duration_ms": renderTime,
            "react.render.count": metricsRef.current.renderCount,
          });

          // Check for slow renders
          if (renderTime > this.renderThreshold) {
            spanRef.current.addEvent("slow_render", {
              duration_ms: renderTime,
              threshold_ms: this.renderThreshold,
            });

            addBreadcrumb({
              type: "custom",
              category: "react",
              message: `Slow render in ${displayName}: ${renderTime.toFixed(2)}ms`,
              data: {
                component: displayName,
                renderTime,
                renderCount: metricsRef.current.renderCount,
              },
            });
          }

          spanRef.current.end();
        }
      });

      // Start render span
      renderStartRef.current = performance.now();
      spanRef.current = startSpan(`react.${displayName}.render`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          "react.component": displayName,
          "react.lifecycle": "render",
          "react.props": JSON.stringify(Object.keys(props || {})),
        },
      });

      try {
        return <Component {...props} />;
      } catch (error) {
        metricsRef.current.errorCount++;

        if (spanRef.current) {
          spanRef.current.recordException(error as Error);
          spanRef.current.setStatus({ code: 1, message: (error as Error).message });
          spanRef.current.end();
        }

        reportError(error, {
          errorType: "render",
          context: {
            component: displayName,
            props: Object.keys(props || {}),
            renderCount: metricsRef.current.renderCount,
          },
        });

        throw error;
      }
    };

    TracedComponent.displayName = `Traced(${displayName})`;
    return TracedComponent;
  }

  public withErrorBoundary<P extends object>(Component: ComponentType<P>, fallback?: ReactNode): ComponentType<P> {
    return class extends React.Component<P, { hasError: boolean; error?: Error }> {
      static displayName = `ErrorBoundary(${Component.displayName || Component.name})`;

      state = {
        hasError: false,
        error: undefined,
      };

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        const componentName = Component.displayName || Component.name || "Unknown";

        const span = startSpan(`react.${componentName}.error`, {
          kind: SpanKind.INTERNAL,
          attributes: {
            "react.component": componentName,
            "react.error": error.message,
            "react.error.stack": error.stack,
            "react.error.component_stack": errorInfo.componentStack,
          },
        });

        span.recordException(error);
        span.setStatus({ code: 1, message: error.message });
        span.end();

        reportError(error, {
          errorType: "render",
          context: {
            component: componentName,
            componentStack: errorInfo.componentStack,
          },
        });

        addBreadcrumb({
          type: "custom",
          category: "react",
          message: `Error in ${componentName}`,
          data: {
            error: error.message,
            component: componentName,
          },
        });
      }

      render() {
        if (this.state.hasError) {
          return (
            fallback || (
              <div className="error-boundary-fallback">
                <h2>Something went wrong</h2>
                <details style={{ whiteSpace: "pre-wrap" }}>{this.state.error?.toString()}</details>
              </div>
            )
          );
        }

        return <Component {...this.props} />;
      }
    };
  }

  public getMetrics(componentName: string): ComponentMetrics | undefined {
    return this.componentMetrics.get(componentName);
  }

  public getAllMetrics(): Map<string, ComponentMetrics> {
    return new Map(this.componentMetrics);
  }

  public setRenderThreshold(ms: number): void {
    this.renderThreshold = ms;
  }
}

// Hooks for component tracing
export function useComponentTrace(componentName: string): void {
  const mountTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  useEffect(() => {
    mountTimeRef.current = Date.now();

    const span = startSpan(`react.${componentName}.mount`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "react.component": componentName,
        "react.lifecycle": "mount",
      },
    });
    span.end();

    return () => {
      const lifetime = Date.now() - mountTimeRef.current;

      const unmountSpan = startSpan(`react.${componentName}.unmount`, {
        kind: SpanKind.INTERNAL,
        attributes: {
          "react.component": componentName,
          "react.lifecycle": "unmount",
          "react.component.lifetime_ms": lifetime,
          "react.component.render_count": renderCountRef.current,
        },
      });
      unmountSpan.end();
    };
  }, [componentName]);

  useEffect(() => {
    renderCountRef.current++;
  });
}

export function useInteractionTrace(action: string): (event?: any) => void {
  return (event?: any) => {
    const span = startSpan(`react.interaction.${action}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "interaction.action": action,
        "interaction.target": event?.target?.tagName,
        "interaction.type": event?.type,
        "trace.id": getCurrentTraceId(),
      },
    });

    addBreadcrumb({
      type: "click",
      category: "user",
      message: `User interaction: ${action}`,
      data: {
        action,
        target: event?.target?.tagName,
        type: event?.type,
      },
    });

    span.end();
  };
}

export function useRenderMetrics(componentName: string): {
  renderCount: number;
  avgRenderTime: number;
  lastRenderTime: number;
} {
  const [metrics, setMetrics] = React.useState({
    renderCount: 0,
    avgRenderTime: 0,
    lastRenderTime: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const componentMetrics = reactInstrumentation.getMetrics(componentName);
      if (componentMetrics) {
        setMetrics({
          renderCount: componentMetrics.renderCount,
          avgRenderTime:
            componentMetrics.renderCount > 0 ? componentMetrics.totalRenderTime / componentMetrics.renderCount : 0,
          lastRenderTime: componentMetrics.lastRenderTime,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [componentName]);

  return metrics;
}

// Export singleton instance
export const reactInstrumentation = ReactInstrumentation.getInstance();

// Export convenience functions
export const traceComponent = reactInstrumentation.traceComponent.bind(reactInstrumentation);
export const withErrorBoundary = reactInstrumentation.withErrorBoundary.bind(reactInstrumentation);

// HOC decorator for class components
export function traced(componentName?: string) {
  return function <T extends ComponentType<any>>(Component: T): T {
    return reactInstrumentation.traceComponent(Component, componentName) as T;
  };
}

// HOC for functional components
export function withTrace<P extends object>(Component: ComponentType<P>, componentName?: string): ComponentType<P> {
  return reactInstrumentation.traceComponent(Component, componentName);
}
