# Observability Guide

## Structured Logging
- FastAPI now emits JSON logs with `request_id` attached.
- You can forward stdout to Loki/ELK; every entry has `service.name`, log level, and request correlation.
- The `X-Request-ID` header is echoed on responses to trace client calls across services.

## Metrics
- Prometheus metrics are exposed at `/metrics` via `prometheus_fastapi_instrumentator`.
- Suggested scrape config:
  ```yaml
  - job_name: township-backend
    static_configs:
      - targets: ['backend:8000']
  ```
- Includes latency, request counts, response code buckets, and in-progress request gauges.

## Tracing
- Enable OTLP tracing by setting:
  ```
  OTEL_ENABLED=true
  OTEL_ENDPOINT=http://otel-collector:4318/v1/traces
  OTEL_HEADERS=Authorization=Bearer%20token  # optional
  ```
- FastAPI routes and asyncpg database calls emit spans you can ship to Tempo/Jaeger/Cloud Trace.

## Dashboards & Alerts
- Hook Prometheus metrics into Grafana for dashboards (request latency, rate limit hits, AI triage queue depth).
- Configure alert rules for 5xx rate, slow response p95, or service downtime.
- Combine JSON logs + request IDs + traces for full-stack debugging.
