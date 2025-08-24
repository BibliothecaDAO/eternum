Local tracing with Jaeger + OpenTelemetry Collector
===================================================

This stack lets the browser send OTLP/HTTP traces to a local OpenTelemetry Collector (with CORS), which then exports to Jaeger for visualization.

What’s included
- Jaeger all-in-one (UI on http://localhost:16686)
- OpenTelemetry Collector (listens on http://localhost:4318/v1/traces)
- Tail sampling (always keep errors and `state.tx.*`, sample others at 10%)

Run locally
1) From repo root:
   docker compose -f observability/docker-compose.yml up -d

2) App config (Vite env):
   - VITE_TRACING_ENABLED=true
   - VITE_TRACING_USE_OTEL=true
   - VITE_TRACING_SAMPLE_RATE=0.1           # client-side head sampling
   - VITE_TRACING_ENDPOINT=http://localhost:4318/v1/traces

3) Start the game app, then open Jaeger UI:
   - http://localhost:16686
   - Select service `eternum-game` (or your configured name)

Notes
- The Collector does tail-based sampling:
  - Keeps all error traces and spans named `state.tx.*`
  - Samples everything else at 10%
- CORS allows localhost by default; adjust `observability/otel-collector-config.yaml` if you use a different dev origin.
- You can enable Jaeger’s own OTLP ports (4317/4318) if you want to point the Collector there; we’re exporting from Collector to Jaeger via OTLP gRPC already.

Troubleshooting
- No traces in Jaeger:
  - Check browser console network for POST to http://localhost:4318/v1/traces
  - Check `docker compose logs -f otel-collector`
  - Ensure VITE_TRACING_* flags are set and your app built with them
- Lots of noise: lower `VITE_TRACING_SAMPLE_RATE` or adjust `tail_sampling` policy in Collector.

