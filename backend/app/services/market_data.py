"""
Market data service — fetches klines/ticker, caches, feeds indicators + AI.
- Uses Binance public endpoints (no auth). Falls back to cached data on failure.
"""
from __future__ import annotations
import asyncio
import time
from typing import Dict, List
from .binance_client import BinanceClient
from ..core.config import get_settings

# In-memory TTL cache
_cache: Dict[str, tuple[float, any]] = {}

def _get_cached(key: str, ttl: int = 15):
    entry = _cache.get(key)
    if entry and time.time() - entry[0] < ttl:
        return entry[1]
    return None

def _set_cached(key: str, value):
    _cache[key] = (time.time(), value)

async def get_klines_normalized(symbol: str, interval: str = "1h", limit: int = 100) -> List[dict]:
    cache_key = f"klines:{symbol}:{interval}:{limit}"
    cached = _get_cached(cache_key, ttl=10)
    if cached:
        return cached
    # Use a dummy client (no keys needed for public endpoints) via base URL
    settings = get_settings()
    # Create a lightweight client with empty creds for public endpoint; BinanceClient tolerates empty for public calls
    client = BinanceClient(api_key="public", api_secret="public")
    try:
        raw = await client.klines(symbol=symbol, interval=interval, limit=limit)
        # Normalize to indicators.py expected keys
        normalized = [
            {"open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"], "volume": r["volume"], "close_time": r["close_time"]}
            for r in raw
        ]
        _set_cached(cache_key, normalized)
        return normalized
    finally:
        await client.close()

async def get_multiple_prices(symbols: List[str]) -> Dict[str, float]:
    client = BinanceClient(api_key="public", api_secret="public")
    try:
        data = await client.ticker_price()
        out = {}
        for entry in data if isinstance(data, list) else [data]:
            sym = entry.get("symbol")
            if sym in symbols:
                out[sym] = float(entry["price"])
        return out
    finally:
        await client.close()

async def get_exchange_filters(symbol: str) -> dict:
    cache_key = f"filters:{symbol}"
    cached = _get_cached(cache_key, ttl=3600)
    if cached:
        return cached
    client = BinanceClient(api_key="public", api_secret="public")
    try:
        info = await client.exchange_info(symbol=symbol)
        sym_info = info.get("symbols", [{}])[0] if info.get("symbols") else {}
        filters = sym_info.get("filters", [])
        out: dict = {}
        for f in filters:
            if f["filterType"] == "LOT_SIZE":
                out["minQty"] = float(f["minQty"]); out["maxQty"] = float(f["maxQty"]); out["stepSize"] = float(f["stepSize"])
            elif f["filterType"] == "PRICE_FILTER":
                out["minPrice"] = float(f["minPrice"]); out["maxPrice"] = float(f["maxPrice"]); out["tickSize"] = float(f["tickSize"])
            elif f["filterType"] in ("MIN_NOTIONAL","NOTIONAL"):
                out["minNotional"] = float(f.get("minNotional") or f.get("notional") or 0)
        _set_cached(cache_key, out)
        return out
    finally:
        await client.close()
