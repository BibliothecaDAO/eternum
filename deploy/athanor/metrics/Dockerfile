FROM otel/opentelemetry-collector-contrib@sha256:fd328de2552466ad78385e1b1289c3f2402b1c45f265b252aab1955b42845ac1 AS collector
FROM python:3.12.12-slim-bookworm@sha256:593bd06efe90efa80dc4eee3948be7c0fde4134606dd40d8dd8dbcade98e669c
COPY --from=collector /otelcol-contrib /otelcol-contrib
COPY collect_cpu.py /collect_cpu.py
USER 10001:10001
ENTRYPOINT ["python3", "/collect_cpu.py"]
CMD ["--config=/config/collector.json"]
