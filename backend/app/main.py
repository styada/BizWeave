from fastapi import FastAPI
from sqlalchemy import text

from .database import engine, get_session
from .settings import settings

app = FastAPI(title=settings.app_name)


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "ok": "true",
        "environment": settings.environment,
    }


@app.get("/storage/version")
def storage_version() -> dict[str, str | None]:
    session = get_session()
    try:
        row = session.execute(text("select version_num from alembic_version limit 1")).first()
        return {"version": row[0] if row else None}
    except Exception:
        return {"version": None}
    finally:
        session.close()
