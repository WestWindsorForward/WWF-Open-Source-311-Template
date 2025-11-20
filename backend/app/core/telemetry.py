from __future__ import annotations

import logging
from typing import Any

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

logger = logging.getLogger(__name__)


def configure_tracing(app) -> None:
    if not settings.otel_enabled or not settings.otel_endpoint:
        return

    resource = Resource.create({"service.name": settings.project_name, "deployment.environment": settings.environment})
    provider = TracerProvider(resource=resource)

    headers: dict[str, Any] | None = None
    if settings.otel_headers:
        headers = {
            kv.split("=", 1)[0].strip(): kv.split("=", 1)[1].strip()
            for kv in settings.otel_headers.split(",")
            if "=" in kv
        }

    exporter = OTLPSpanExporter(endpoint=settings.otel_endpoint, headers=headers)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    FastAPIInstrumentor.instrument_app(app)
    AsyncPGInstrumentor().instrument()
    logger.info("OpenTelemetry tracing enabled", extra={"otel_endpoint": settings.otel_endpoint})
