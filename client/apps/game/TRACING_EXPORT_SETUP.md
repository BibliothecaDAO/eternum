# Tracing Export Setup Guide

This guide explains how to set up various export endpoints for the Eternum tracing system.

## Quick Start

### 1. Environment Configuration

Add these to your `.env.local` file:

```env
# Enable tracing (required)
VITE_TRACING_ENABLED=true

# Choose your export endpoint (see options below)
VITE_TRACING_ENDPOINT=http://localhost:4318/v1/traces

# Sampling configuration
VITE_TRACING_SAMPLE_RATE=0.1        # 10% of normal traces
VITE_TRACING_ERROR_SAMPLE_RATE=1.0  # 100% of error traces

# Performance monitoring
VITE_PERF_MONITORING_ENABLED=true
VITE_PERF_FPS_THRESHOLD=30
```

## Export Options

### Option 1: Jaeger (Recommended for Development)

Jaeger is an open-source distributed tracing platform.

#### Docker Setup

```bash
# Run Jaeger All-in-One
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

#### Environment Configuration

```env
VITE_TRACING_ENDPOINT=http://localhost:4318/v1/traces
```

#### Access UI

Open http://localhost:16686 to view traces.

### Option 2: Grafana Cloud (Production)

Grafana Cloud provides managed observability with Tempo for traces.

#### Setup Steps

1. Create a free account at https://grafana.com/products/cloud/
2. Navigate to your stack → Configuration → Data Sources → Tempo
3. Get your endpoint and API key

#### Environment Configuration

```env
VITE_TRACING_ENDPOINT=https://tempo-us-central1.grafana.net/tempo/api/push
VITE_TRACING_AUTH_HEADER=Basic <base64_encoded_user:api_key>
```

#### Update Tracer Configuration

```typescript
// src/tracing/tracer.ts - Add auth header support
const otlpExporter = new OTLPTraceExporter({
  url: finalConfig.endpoint,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': env.VITE_TRACING_AUTH_HEADER || '',
  },
});
```

### Option 3: Datadog

Datadog APM provides comprehensive application performance monitoring.

#### Setup Steps

1. Sign up for Datadog at https://www.datadoghq.com/
2. Install Datadog Agent or use their cloud endpoint
3. Get your API key from Organization Settings

#### Environment Configuration

```env
VITE_TRACING_ENDPOINT=https://trace.agent.datadoghq.com/v0.3/traces
VITE_DATADOG_API_KEY=your_api_key_here
VITE_DATADOG_SITE=datadoghq.com  # or datadoghq.eu for EU
```

#### Update Tracer Configuration

```typescript
// src/tracing/tracer.ts - Add Datadog support
const otlpExporter = new OTLPTraceExporter({
  url: finalConfig.endpoint,
  headers: {
    'DD-API-KEY': env.VITE_DATADOG_API_KEY || '',
    'Content-Type': 'application/json',
  },
});
```

### Option 4: New Relic

New Relic One provides full-stack observability.

#### Setup Steps

1. Create account at https://newrelic.com/
2. Navigate to Browser → Add Data
3. Get your license key and endpoint

#### Environment Configuration

```env
VITE_TRACING_ENDPOINT=https://otlp.nr-data.net:4318/v1/traces
VITE_NEW_RELIC_LICENSE_KEY=your_license_key_here
```

#### Update Tracer Configuration

```typescript
// src/tracing/tracer.ts - Add New Relic support
const otlpExporter = new OTLPTraceExporter({
  url: finalConfig.endpoint,
  headers: {
    'api-key': env.VITE_NEW_RELIC_LICENSE_KEY || '',
  },
});
```

### Option 5: OpenTelemetry Collector (Advanced)

Use the OpenTelemetry Collector to export to multiple backends simultaneously.

#### Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4318:4318"   # OTLP HTTP
      - "4317:4317"   # OTLP gRPC
      - "8888:8888"   # Prometheus metrics

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14250:14250"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
```

#### Collector Configuration

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024

  resource:
    attributes:
      - key: environment
        value: production
        action: upsert

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

  prometheus:
    endpoint: "0.0.0.0:8888"

  logging:
    loglevel: debug

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [jaeger, logging]
    
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus, logging]
```

#### Environment Configuration

```env
VITE_TRACING_ENDPOINT=http://localhost:4318/v1/traces
```

## Testing Your Setup

### 1. Verify Tracing is Enabled

Open browser console and look for:
```
🔍 Tracing system initialized
```

### 2. Generate Test Traces

```javascript
// In browser console
window.testTracing = async () => {
  const { TracingHelpers } = await import('./tracing');
  
  // Generate a test trace
  await TracingHelpers.measureGameOperation(
    'test_operation',
    async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    }
  );
  
  console.log('Test trace sent!');
};

window.testTracing();
```

### 3. Trigger an Error

```javascript
// In browser console
window.testError = () => {
  throw new Error('Test error for tracing');
};

try {
  window.testError();
} catch (e) {
  console.log('Error captured');
}
```

### 4. Check Your Backend

- **Jaeger**: http://localhost:16686
- **Grafana**: Your Grafana Cloud instance
- **Datadog**: APM → Traces
- **New Relic**: APM & Services → Distributed Tracing

## Production Deployment

### 1. Security Considerations

- Never expose API keys in client-side code
- Use environment variables for sensitive configuration
- Consider using a proxy server for authentication

### 2. Performance Optimization

```env
# Production settings
VITE_TRACING_SAMPLE_RATE=0.01       # 1% sampling for high traffic
VITE_TRACING_ERROR_SAMPLE_RATE=1.0  # Always sample errors
VITE_PERF_MONITORING_ENABLED=true   # Keep monitoring enabled
```

### 3. Monitoring Costs

Different providers have different pricing:

- **Jaeger**: Free (self-hosted)
- **Grafana Cloud**: Free tier includes 50GB traces/month
- **Datadog**: ~$31/host/month + ingestion costs
- **New Relic**: Free tier includes 100GB/month

### 4. Data Retention

Configure retention based on your needs:

- Development: 7 days
- Staging: 30 days
- Production: 90+ days

## Troubleshooting

### Traces Not Appearing

1. Check browser console for errors
2. Verify endpoint is accessible: `curl -X POST ${VITE_TRACING_ENDPOINT}`
3. Check CORS headers if using external endpoint
4. Verify sampling rate isn't too low

### High Memory Usage

1. Reduce batch size in exporter
2. Lower sampling rate
3. Disable verbose span attributes

### Network Errors

1. Check firewall rules
2. Verify SSL certificates for HTTPS endpoints
3. Use proxy for cross-origin requests

## Dashboard Setup

### Key Metrics to Monitor

1. **Error Rate**: Errors per minute by type
2. **P95 Latency**: 95th percentile response times
3. **Throughput**: Requests per second
4. **Apdex Score**: Application performance index

### Alert Configuration

```yaml
# Example alert rules
alerts:
  - name: high_error_rate
    condition: error_rate > 1%
    duration: 5m
    severity: warning

  - name: slow_response_time
    condition: p95_latency > 1000ms
    duration: 10m
    severity: warning

  - name: low_fps
    condition: avg_fps < 30
    duration: 2m
    severity: critical
```

## Advanced Configuration

### Custom Exporters

```typescript
// src/tracing/exporters/custom-exporter.ts
import { SpanExporter } from '@opentelemetry/sdk-trace-base';

export class CustomExporter implements SpanExporter {
  export(spans, resultCallback) {
    // Send to your custom backend
    fetch('https://your-backend.com/traces', {
      method: 'POST',
      body: JSON.stringify(spans),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key',
      },
    })
    .then(() => resultCallback({ code: 0 }))
    .catch(err => resultCallback({ code: 1, error: err }));
  }

  shutdown() {
    return Promise.resolve();
  }
}
```

### Trace Sampling Strategies

```typescript
// src/tracing/sampling/custom-sampler.ts
export class GameAwareSampler {
  shouldSample(context, traceId, spanName, spanKind, attributes) {
    // Always sample critical game operations
    if (spanName.includes('battle') || spanName.includes('trade')) {
      return { decision: 1 }; // RECORD_AND_SAMPLED
    }
    
    // Sample based on user tier
    const userTier = attributes['user.tier'];
    if (userTier === 'premium') {
      return { decision: Math.random() < 0.5 ? 1 : 0 };
    }
    
    // Default sampling
    return { decision: Math.random() < 0.01 ? 1 : 0 };
  }
}
```

## Next Steps

1. Choose your export backend based on requirements
2. Configure environment variables
3. Deploy and monitor
4. Set up dashboards and alerts
5. Optimize sampling rates based on volume

For support, check the [OpenTelemetry documentation](https://opentelemetry.io/docs/) or file an issue in the repository.