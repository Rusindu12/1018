"""
WebSocket manager:
- Backend connects to Binance combined streams (e.g. btcusdt@trade/stream multi-stream)
- Re-broadcasts to authenticated app clients via FastAPI WebSocket.
- Handles reconnection, heartbeat, and structured error events.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import WebSocket, WebSocketDisconnect
import websockets

from ..core.config import get_settings

logger = logging.getLogger("ws_manager")

class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()
        self.user_map: Dict[str, Set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, user_id: str | None = None):
        await ws.accept()
        self.active.add(ws)
        if user_id:
            self.user_map.setdefault(user_id, set()).add(ws)

    def disconnect(self, ws: WebSocket, user_id: str | None = None):
        self.active.discard(ws)
        if user_id and user_id in self.user_map:
            self.user_map[user_id].discard(ws)

    async def broadcast(self, message: dict):
        dead = []
        payload = json.dumps(message)
        for ws in list(self.active):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(d)

    async def send_to_user(self, user_id: str, message: dict):
        for ws in list(self.user_map.get(user_id, [])):
            try:
                await ws.send_text(json.dumps(message))
            except Exception:
                self.disconnect(ws, user_id)

manager = ConnectionManager()

# Binance proxy task (singleton)
_binance_task: asyncio.Task | None = None
_symbols = ["btcusdt","ethusdt","bnbusdt","solusdt"]

async def binance_proxy_loop(symbols: list[str] | None = None):
    settings = get_settings()
    syms = symbols or _symbols
    streams = "/".join([f"{s}@kline_1m" for s in syms])  # 1m klines for dashboard
    url = f"{settings.binance_ws_url}/stream?streams={streams}"
    backoff = 1
    while True:
        try:
            logger.info(f"Connecting to Binance WS: {url}")
            async with websockets.connect(url, ping_interval=20) as ws:
                backoff = 1
                async for raw in ws:
                    try:
                        data = json.loads(raw)
                        await manager.broadcast({"type": "market.kline", "data": data})
                    except Exception as e:
                        logger.warning(f"WS parse error: {e}")
        except Exception as e:
            logger.error(f"Binance WS error: {e} — retry in {backoff}s")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)

def start_binance_proxy(symbols: list[str] | None = None):
    global _binance_task
    if _binance_task and not _binance_task.done():
        return
    loop = asyncio.get_event_loop()
    _binance_task = loop.create_task(binance_proxy_loop(symbols))
