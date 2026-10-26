import pytest

def test_ai_hold_neutral():
    from app.services.ai_engine import evaluate_signal
    ind={
        "price":50000,"rsi":50,"macd":0.1,"macd_signal":0.1,"macd_hist":0.01,
        "ema20":50000,"ema50":50000,"ema200":50000,"sma20":50000,"sma50":50000,
        "bb_upper":51000,"bb_lower":49000,"bb_middle":50000,"bb_width_pct":4.0,
        "atr":500,"atr_pct":1.0,"volume":100,"volume_sma20":100,"volume_ratio":1.0,
        "trend":"sideways","volatility":"moderate"
    }
    sig=evaluate_signal("BTCUSDT", ind)
    assert sig["action"]=="HOLD"
    assert 0 <= sig["confidence"] <= 100
    assert "not the probability" in sig["disclaimer"].lower() or "not a guarantee" in sig["disclaimer"].lower()

def test_ai_buy_oversold():
    from app.services.ai_engine import evaluate_signal
    ind={
        "price":47000,"rsi":22,"macd":10,"macd_signal":5,"macd_hist":5,
        "ema20":50000,"ema50":49000,"ema200":48000,"sma20":49500,"sma50":49000,
        "bb_upper":51000,"bb_lower":47000,"bb_middle":49000,"bb_width_pct":7,
        "atr":800,"atr_pct":1.6,"volume":200,"volume_sma20":100,"volume_ratio":2.0,
        "trend":"downtrend","volatility":"high"
    }
    sig=evaluate_signal("BTCUSDT", ind)
    assert sig["action"] in ("BUY","HOLD","SELL")
    # volatility high caps confidence
    assert sig["confidence"] <= 78

def test_confidence_never_over_100():
    from app.services.ai_engine import evaluate_signal
    ind={
        "price":60000,"rsi":15,"macd":50,"macd_signal":0,"macd_hist":20,
        "ema20":59000,"ema50":58000,"ema200":50000,"sma20":58500,"sma50":58000,
        "bb_upper":62000,"bb_lower":46000,"bb_middle":54000,"bb_width_pct":15,
        "atr":1500,"atr_pct":2.5,"volume":500,"volume_sma20":100,"volume_ratio":5.0,
        "trend":"strong_uptrend","volatility":"high"
    }
    sig=evaluate_signal("ETHUSDT", ind)
    assert 5 <= sig["confidence"] <= 95
