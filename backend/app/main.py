from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from sqlalchemy import text
from app.db.session import engine
from alembic.config import Config
from alembic import command
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.routes import admin, auth, open311, resident, staff
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.telemetry import configure_tracing
from app.services import settings_snapshot
from app.middleware.request_id import RequestIDMiddleware

configure_logging()

instrumentator = Instrumentator()


@asynccontextmanager
async def lifespan(app: FastAPI):
    instrumentator.expose(app)
    configure_tracing(app)
    yield


app = FastAPI(title=settings.project_name, lifespan=lifespan)
instrumentator.instrument(app)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.backend_cors_origins] or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(open311.router)
app.include_router(resident.router, prefix=settings.api_v1_prefix)
app.include_router(admin.router, prefix=settings.api_v1_prefix)
app.include_router(staff.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router)

storage_path = Path(settings.storage_dir).resolve()
storage_path.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_path), name="storage")


@app.on_event("startup")
async def restore_settings_from_disk() -> None:
    # Auto-run Alembic migrations to head for one-command setup
    try:
        alembic_ini = (Path(__file__).resolve().parent.parent / "alembic.ini").as_posix()
        alembic_dir = (Path(__file__).resolve().parent.parent / "alembic").as_posix()
        cfg = Config(alembic_ini)
        cfg.set_main_option("script_location", alembic_dir)
        command.upgrade(cfg, "head")
    except Exception:
        pass
    # Ensure new columns exist when running without full Alembic context
    try:
        async with engine.begin() as conn:
            # Add road_name_filters column if missing
            check_sql = text(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name='geo_boundaries' AND column_name='road_name_filters'
                """
            )
            result = await conn.execute(check_sql)
            if result.first() is None:
                await conn.execute(text("ALTER TABLE geo_boundaries ADD COLUMN road_name_filters JSONB DEFAULT '[]'::jsonb"))
            # Create category_exclusions table if missing
            t_check = await conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_name='category_exclusions'"))
            if t_check.first() is None:
                await conn.execute(text(
                    """
                    CREATE TABLE category_exclusions (
                        id SERIAL PRIMARY KEY,
                        category_slug VARCHAR(128) NOT NULL,
                        redirect_name VARCHAR(255),
                        redirect_url VARCHAR(512),
                        redirect_message TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_category_exclusions_category_slug ON category_exclusions (category_slug);
                    """
                ))
            # Create road_exclusions table if missing
            r_check = await conn.execute(text("SELECT 1 FROM information_schema.tables WHERE table_name='road_exclusions'"))
            if r_check.first() is None:
                await conn.execute(text(
                    """
                    CREATE TABLE road_exclusions (
                        id SERIAL PRIMARY KEY,
                        road_name VARCHAR(255) NOT NULL,
                        redirect_name VARCHAR(255),
                        redirect_url VARCHAR(512),
                        redirect_message TEXT,
                        is_active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS ix_road_exclusions_road_name ON road_exclusions (road_name);
                    """
                ))
    except Exception:
        pass
    await settings_snapshot.bootstrap_from_disk()


@app.get("/health", tags=["Health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


class StorageCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        if request.url.path.startswith("/storage/branding-"):
            # Encourage edge/browser caching; filenames include digest for cache-busting
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


app.add_middleware(StorageCacheMiddleware)
