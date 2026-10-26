import pytest
import random

# Unit tests for indicator calculations

def gen_candles(n=150, start_price=50000):
    candles=[]
    price=start_price
    for i in range(n):
        change = random.uniform(-50,50)
        price = max(1000, price+change)
        candles.append({
            "open": price-5, "high": price+20, "low": price-20, "close": price,
            "volume": random.uniform(80,120), "close_time": i
        })
    return candles

def test_compute_indicators_basic():
    from app.services.indicators import compute_indicators
    candles=gen_candles(200)
    ind=compute_indicators(candles)
    assert 0 <= ind["rsi"] <= 100
    assert ind["ema20"] != 0
    assert ind["bb_upper"] > ind["bb_lower"]
    assert ind["trend"] in ("strong_uptrend","downtrend","sideways")
    assert ind["volatility"] in ("high","moderate","low")

def test_insufficient_candles():
    from app.services.indicators import compute_indicators
    with pytest.raises(ValueError):
        compute_indicators(gen_candles(10))

def test_deterministic_trend():
    from app.services.indicators import compute_indicators
    # Strong uptrend: increasing price
    candles=[{"open":100+i,"high":101+i,"low":99+i,"close":100+i,"volume":100,"close_time":i} for i in range(200)]
    ind=compute_indicators(candles)
    assert ind["trend"]=="strong_uptrend"
    assert ind["rsi"] > 50

def test_volatility_classification():
    from app.services.indicators import compute_indicators
    # Very flat price -> low volatility
    candles=[{"open":50000,"high":50001,"low":49999,"close":50000,"volume":100,"close_time":i} for i in range(200)]
    ind=compute_indicators(candles)
    assert ind["volatility"] in ("low","moderate")
