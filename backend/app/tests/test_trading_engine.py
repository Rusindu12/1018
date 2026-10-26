"""
Simulated trading tests — paper trading + risk integration.
"""
import pytest
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.database import Base
from app.models.setting import RiskSetting, TradingModeState
from app.services.trading_engine import TradingEngine
from types import SimpleNamespace

@pytest.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        yield session
    await engine.dispose()

@pytest.mark.asyncio
async def test_paper_buy_and_sell(db):
    engine = TradingEngine(db)
    # BUY
    t1 = await engine.create_paper_trade(user_id="user-1", symbol="BTCUSDT", side="BUY", quantity=0.01, price=50000)
    assert t1.status=="FILLED"
    assert t1.fee > 0
    # SELL at profit
    t2 = await engine.create_paper_trade(user_id="user-1", symbol="BTCUSDT", side="SELL", quantity=0.01, price=52000)
    assert t2.status=="FILLED"
    # Realized PnL should be >0
    from sqlalchemy import select
    from app.models.trade import Position
    res = await db.execute(select(Position).where(Position.user_id=="user-1"))
    pos = res.scalar_one_or_none()
    # After sell qty 0, should be near 0
    assert pos.quantity == pytest.approx(0, abs=1e-6)

@pytest.mark.asyncio
async def test_duplicate_order_guard(db):
    engine = TradingEngine(db)
    cid="paper_dup_test_123"
    await engine.create_paper_trade(user_id="user-1", symbol="ETHUSDT", side="BUY", quantity=0.1, price=3000, client_order_id=cid)
    with pytest.raises(Exception):
        await engine.create_paper_trade(user_id="user-1", symbol="ETHUSDT", side="BUY", quantity=0.1, price=3000, client_order_id=cid)

@pytest.mark.asyncio
async def test_emergency_stop():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as session:
        eng = TradingEngine(session)
        await eng.emergency_stop(user_id="u1", reason="test")
        from sqlalchemy import select
        from app.models.setting import TradingModeState
        res = await session.execute(select(TradingModeState).where(TradingModeState.user_id=="u1"))
        state=res.scalar_one_or_none()
        assert state.emergency_stop is True
        assert state.auto_trading_enabled is False
    await engine.dispose()

def test_no_guaranteed_profits_disclaimer():
    from app.services.ai_engine import evaluate_signal
    ind={"price":50000,"rsi":50,"macd":0,"macd_signal":0,"macd_hist":0,"ema20":50000,"ema50":50000,"ema200":50000,"sma20":50000,"sma50":50000,"bb_upper":51000,"bb_lower":49000,"bb_middle":50000,"bb_width_pct":4,"atr":500,"atr_pct":1,"volume":100,"volume_sma20":100,"volume_ratio":1,"trend":"sideways","volatility":"moderate"}
    sig=evaluate_signal("BTCUSDT", ind)
    assert "not" in sig["disclaimer"].lower() and "profit" in sig["disclaimer"].lower()
