from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_db
from ..services.market_data import get_klines_normalized, get_multiple_prices, get_exchange_filters
from ..services.indicators import compute_indicators
from ..services.ai_engine import evaluate_signal
from ..services.websocket_manager import manager

router = APIRouter()

ELIGIBLE = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","ADAUSDT","XRPUSDT","DOGEUSDT","AVAXUSDT"]

@router.get("/prices")
async def prices(symbols: str = Query(default="BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT")):
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    data = await get_multiple_prices(sym_list)
    return {"prices": data, "count": len(data)}

@router.get("/klines/{symbol}")
async def klines(symbol: str, interval: str = Query(default="1h", pattern="^(1m|5m|15m|1h|4h|1d)$"), limit: int = Query(default=100, ge=10, le=500)):
    raw = await get_klines_normalized(symbol.upper(), interval, limit)
    return {"symbol": symbol.upper(), "interval": interval, "candles": raw}

@router.get("/indicators/{symbol}")
async def indicators(symbol: str, interval: str = "1h"):
    candles = await get_klines_normalized(symbol.upper(), interval, 150)
    ind = compute_indicators(candles)
    return {"symbol": symbol.upper(), "interval": interval, "indicators": ind}

@router.get("/signals/{symbol}")
async def signal_for_symbol(symbol: str, interval: str = "1h"):
    candles = await get_klines_normalized(symbol.upper(), interval, 150)
    ind = compute_indicators(candles)
    sig = evaluate_signal(symbol.upper(), ind, interval)
    # stringify datetime
    sig["generated_at"] = sig["generated_at"].isoformat()
    return sig

@router.get("/signals")
async def signals_batch(symbols: str = Query(default="BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT"), interval: str = "1h"):
    sym_list = [s.strip().upper() for s in symbols.split(",")]
    out = []
    for sym in sym_list:
        try:
            candles = await get_klines_normalized(sym, interval, 150)
            ind = compute_indicators(candles)
            sig = evaluate_signal(sym, ind, interval)
            sig["generated_at"] = sig["generated_at"].isoformat()
            out.append(sig)
        except Exception as e:
            out.append({"symbol": sym, "error": str(e)})
    return {"signals": out}

@router.get("/exchange-filters/{symbol}")
async def filters(symbol: str):
    f = await get_exchange_filters(symbol.upper())
    return {"symbol": symbol.upper(), "filters": f}

@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    # Auth via query token? For demo, allow anonymous but tag
    await manager.connect(websocket, user_id="anon")
    try:
        while True:
            # Keep alive; client may send ping/symbol subscriptions
            msg = await websocket.receive_text()
            # Echo back available command
            await websocket.send_text(f'{{"type":"pong","echo":{msg[:200]}}}')
    except WebSocketDisconnect:
        manager.disconnect(websocket, "anon")
