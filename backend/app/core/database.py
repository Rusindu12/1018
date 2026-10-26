"""SQLAlchemy async engine + session. Defaults to SQLite for dev, Postgres via asyncpg."""
from __future__ import annotations

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings

def _async_url(sync_url: str) -> str:
    # Convert sync URLs to async drivers
    if sync_url.startswith("sqlite:///"):
        return sync_url.replace("sqlite:///", "sqlite+aiosqlite:///")
    if sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")
    if sync_url.startswith("postgresql+psycopg2://"):
        return sync_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    return sync_url

settings = get_settings()
DATABASE_URL = _async_url(settings.database_url)

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.debug,
    future=True,
    # SQLite needs check_same_thread false
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

async_session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
