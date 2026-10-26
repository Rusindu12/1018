"""
FastAPI entrypoint — AI Binance Trader backend.
- JWT auth, CORS, structured logging (no secrets), reconnection logic.
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .core.config import get_settings
from .core.database import init_db
from .routers import auth, binance, market, trading, risk, system
from .services.websocket_manager import start_binance_proxy

settings = get_settings()

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("ai_binance_trader")

# Redact secrets from logs
class SecretFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage().lower()
        for kw in ("api_secret","api secret","password","authorization","fernet"):
            if kw in msg:
                record.msg = "[REDACTED SECRET IN LOG]"
                record.args = ()
        return True

logging.getLogger().addFilter(SecretFilter())

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.app_name} env={settings.app_env} testnet={settings.binance_testnet}")
    await init_db()
    # Ensure default risk/mode rows handled lazily per user
    if not settings.binance_testnet:
        logger.warning("Binance Testnet is OFF — live orders possible only after explicit user consent and risk config")
    # Start Binance WS proxy in background
    try:
        start_binance_proxy()
    except Exception as e:
        logger.warning(f"Binance WS proxy not started: {e}")
    yield
    logger.info("Shutting down")

app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan, docs_url="/docs", redoc_url="/redoc")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Timing middleware
@app.middleware("http")
async def add_process_time(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = str(time.time() - start)
    # Never echo secrets
    return response

# Routers
app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["auth"])
app.include_router(binance.router, prefix=f"{settings.api_prefix}/binance", tags=["binance"])
app.include_router(market.router, prefix=f"{settings.api_prefix}/market", tags=["market"])
app.include_router(trading.router, prefix=f"{settings.api_prefix}/trading", tags=["trading"])
app.include_router(risk.router, prefix=f"{settings.api_prefix}/risk", tags=["risk"])
app.include_router(system.router, prefix=f"{settings.api_prefix}/system", tags=["system"])

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.app_name, "env": settings.app_env, "testnet": settings.binance_testnet}

@app.get("/")
async def root():
    return {"message": "AI Binance Trader API — see /docs", "health": "/health"}

@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error at {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error — check logs (secrets redacted)."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug)
