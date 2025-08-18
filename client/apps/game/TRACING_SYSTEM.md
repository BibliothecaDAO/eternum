# Eternum Game Tracing System

## Overview

This document describes the comprehensive tracing system implementation for the Eternum game client. The system provides
end-to-end visibility into application performance, errors, and user interactions across all layers of the stack.

## Architecture

### Core Components

1. **OpenTelemetry SDK** - Foundation for distributed tracing
2. **Custom Instrumentations** - Game-specific trace collectors
3. **Error Reporter** - Enhanced error tracking with context
4. **Performance Monitor** - Real-time performance metrics
5. **Correlation Engine** - Cross-layer trace correlation

### Data Flow

```
User Action → UI Component → API Call → WebSocket → Backend
     ↓            ↓            ↓          ↓          ↓
   Trace ID    Span Created  Propagated  Tracked   Logged
```

## Installation

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch @opentelemetry/instrumentation-xml-http-request @opentelemetry/context-zone @opentelemetry/exporter-trace-otlp-http
```

## Configuration

### Environment Variables

```env
# Tracing Configuration
VITE_TRACING_ENABLED=true
VITE_TRACING_ENDPOINT=http://localhost:4318/v1/traces
VITE_TRACING_SERVICE_NAME=eternum-game
VITE_TRACING_SAMPLE_RATE=0.1
VITE_TRACING_ERROR_SAMPLE_RATE=1.0

# Performance Monitoring
VITE_PERF_MONITORING_ENABLED=true
VITE_PERF_FPS_THRESHOLD=30
VITE_PERF_NETWORK_TIMEOUT=5000
```

## Implementation Guide

### 1. Initialize Tracing

```typescript
import { initTracing } from "@/tracing/tracer";

// Initialize at app startup
initTracing({
  serviceName: "eternum-game",
  environment: env.VITE_PUBLIC_CHAIN,
  version: env.VITE_PUBLIC_GAME_VERSION,
});
```

### 2. Instrument Components

```typescript
import { trace } from '@/tracing/instrumentation/react-instrumentation';

@trace('ComponentName')
export const MyComponent = () => {
  // Component logic
};
```

### 3. Track Operations

```typescript
import { startSpan } from "@/tracing/tracer";

const span = startSpan("operation.name", {
  attributes: {
    "game.realm_id": realmId,
    "game.action": "trade",
  },
});

try {
  // Perform operation
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: SpanStatusCode.ERROR });
} finally {
  span.end();
}
```

## Instrumentation Layers

### Frontend Layer

- **React Components**: Lifecycle, renders, state updates
- **Three.js**: Scene renders, object updates, camera movements
- **User Interactions**: Clicks, keyboard inputs, navigation
- **Resource Loading**: Assets, textures, models

### Network Layer

- **HTTP Requests**: API calls with automatic tracing
- **WebSocket Events**: Message send/receive tracking
- **Torii Client**: Query performance and subscriptions
- **Chat System**: Message flow and latency

### Data Layer

- **Dojo System Calls**: Transaction tracking and errors
- **SQL Queries**: Performance metrics and slow query detection
- **State Management**: Store updates and subscriptions
- **Cache Operations**: Hit/miss rates and invalidations

## Error Tracking

### Error Categories

1. **System Errors**
   - Dojo system call failures
   - State synchronization issues
   - Configuration errors

2. **Network Errors**
   - WebSocket disconnections
   - API timeouts
   - CORS issues

3. **Game Logic Errors**
   - Invalid game states
   - Rule violations
   - Calculation errors

4. **Rendering Errors**
   - WebGL context loss
   - Three.js exceptions
   - Asset loading failures

### Error Context

Each error includes:

- Trace ID for correlation
- User and session information
- Game state snapshot
- Action breadcrumbs
- Network conditions
- Device capabilities

## Performance Metrics

### Key Metrics

| Metric            | Description         | Target  |
| ----------------- | ------------------- | ------- |
| FPS               | Frames per second   | > 30    |
| TTI               | Time to interactive | < 3s    |
| API Latency       | P95 response time   | < 500ms |
| WebSocket Latency | Message round-trip  | < 100ms |
| Memory Usage      | Heap size           | < 500MB |

### Custom Game Metrics

- Army movement calculation time
- Market transaction processing
- Battle simulation performance
- Map tile rendering speed
- Resource production cycles

## Correlation Patterns

### User Journey Tracking

```
Login → Realm Selection → Game Action → Result
  ↓         ↓              ↓           ↓
TraceID   Same TraceID   Same TraceID  End
```

### Cross-System Correlation

- Frontend action → Backend processing
- WebSocket event → State update → UI render
- Batch operation → Individual queries

## Alerts and Monitoring

### Alert Thresholds

```typescript
const alertThresholds = {
  errorRate: 0.01, // 1% error rate
  p95Latency: 1000, // 1 second
  fpsDrops: 5, // 5 consecutive drops below 30 FPS
  memoryUsage: 0.8, // 80% of available memory
  wsDisconnects: 3, // 3 disconnects in 5 minutes
};
```

### Dashboard Metrics

1. **Real-time Overview**
   - Active users
   - Error rate
   - Average latency
   - System health

2. **Performance Trends**
   - FPS distribution
   - Load time percentiles
   - Memory usage over time
   - Network reliability

3. **Error Analysis**
   - Error frequency by type
   - Error impact (users affected)
   - Error resolution time
   - Top error sources

## Debug Tools

### Development Mode

- Trace visualization overlay
- Performance profiler
- Network inspector
- State debugger

### Production Diagnostics

- Sampling configuration
- User session replay
- Error reproduction
- Performance snapshots

## Privacy and Security

### Data Sanitization

- No passwords or private keys in traces
- User IDs are hashed
- Sensitive game data is redacted
- PII is excluded from exports

### Compliance

- GDPR compliant data handling
- User consent for telemetry
- Data retention policies
- Right to deletion support

## Troubleshooting

### Common Issues

1. **Traces not appearing**
   - Check endpoint configuration
   - Verify sampling rate
   - Ensure CORS headers

2. **Performance impact**
   - Reduce sampling rate
   - Disable verbose spans
   - Use conditional instrumentation

3. **Memory leaks**
   - Clear completed spans
   - Limit breadcrumb history
   - Batch export intervals

## Best Practices

1. **Span Naming**: Use descriptive, hierarchical names
2. **Attributes**: Include relevant context without overdoing it
3. **Sampling**: Higher rates for errors, lower for normal operations
4. **Batching**: Export traces in batches to reduce overhead
5. **Cleanup**: Always end spans in finally blocks

## Migration Guide

### From PostHog to OpenTelemetry

1. Keep PostHog for product analytics
2. Use OpenTelemetry for technical telemetry
3. Correlate data using shared session IDs
4. Gradually migrate error tracking

## API Reference

### Core Functions

```typescript
// Start a new trace
startTrace(name: string, attributes?: Record<string, any>): Span

// Add event to current span
addEvent(name: string, attributes?: Record<string, any>): void

// Record an error
recordError(error: Error, context?: Record<string, any>): void

// Get current trace ID
getCurrentTraceId(): string

// Create child span
createChildSpan(name: string): Span
```

### React Hooks

```typescript
// Track component performance
useComponentTrace(name: string): void

// Track user interactions
useInteractionTrace(action: string): TraceFunction

// Monitor render performance
useRenderMetrics(): RenderMetrics
```

### Decorators

```typescript
// Class method tracing
@traced()
async performAction(): Promise<void>

// Error boundary tracing
@withErrorTrace()
class MyComponent extends React.Component
```

## Roadmap

### Phase 1 (Current)

- [x] Core tracing infrastructure
- [x] Basic error tracking
- [x] Network instrumentation

### Phase 2

- [ ] Advanced game metrics
- [ ] AI-powered anomaly detection
- [ ] Predictive error prevention

### Phase 3

- [ ] Full observability platform
- [ ] Custom dashboard builder
- [ ] Automated incident response

## Support

For issues or questions about the tracing system:

- Check the troubleshooting section
- Review error logs in the console
- Contact the platform team
- File an issue in the repository
