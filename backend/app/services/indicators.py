"""
Technical indicator calculations — RSI, MACD, EMA, SMA, Bollinger, ATR, Volume SMA.
Uses pandas + ta library with numpy fallback for minimal deps.
"""
from __future__ import annotations
import pandas as pd
import numpy as np
from typing import Dict, List

def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()

def _sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window).mean()

def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period).mean()
    # Handle zero-loss case: if avg_loss == 0 and avg_gain > 0 => RSI = 100
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    # Where avg_loss == 0 & avg_gain == 0 -> NaN -> neutral 50; where avg_loss == 0 & avg_gain >0 -> 100
    rsi = rsi.where(avg_loss != 0, 100.0)
    # initial period may still be NaN
    rsi = rsi.fillna(50)
    return rsi

def _macd(close: pd.Series, fast=12, slow=26, signal=9):
    ema_fast = _ema(close, fast)
    ema_slow = _ema(close, slow)
    macd_line = ema_fast - ema_slow
    signal_line = _ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def _bollinger(close: pd.Series, window=20, std=2):
    sma = _sma(close, window)
    stdev = close.rolling(window).std()
    upper = sma + stdev * std
    lower = sma - stdev * std
    return upper, sma, lower

def compute_indicators(candles: List[dict]) -> Dict:
    """
    candles: list of {open, high, low, close, volume, close_time} sorted ascending.
    Returns latest indicator snapshot.
    """
    if len(candles) < 50:
        raise ValueError("Need at least 50 candles for reliable indicators")
    df = pd.DataFrame(candles)
    close = df["close"].astype(float)
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    volume = df["volume"].astype(float)

    rsi = _rsi(close, 14).iloc[-1]
    macd_line, macd_signal, macd_hist = _macd(close)
    ema20 = _ema(close, 20).iloc[-1]
    ema50 = _ema(close, 50).iloc[-1]
    ema200 = _ema(close, 200).iloc[-1] if len(close) >= 200 else _ema(close, len(close)).iloc[-1]
    sma20 = _sma(close, 20).iloc[-1]
    sma50 = _sma(close, 50).iloc[-1]

    bb_upper, bb_middle, bb_lower = _bollinger(close, 20, 2)
    bb_upper_v = bb_upper.iloc[-1]
    bb_lower_v = bb_lower.iloc[-1]
    bb_middle_v = bb_middle.iloc[-1]
    bb_width = ((bb_upper_v - bb_lower_v) / bb_middle_v * 100) if bb_middle_v else 0

    # ATR(14)
    tr = pd.concat([high - low, (high - close.shift()).abs(), (low - close.shift()).abs()], axis=1).max(axis=1)
    atr = tr.rolling(14).mean().iloc[-1]

    vol_sma = volume.rolling(20).mean().iloc[-1]
    vol_ratio = volume.iloc[-1] / vol_sma if vol_sma else 1.0

    price = close.iloc[-1]

    # Trend & volatility classification
    if ema20 > ema50 > ema200 * 0.99:
        trend = "strong_uptrend"
    elif ema20 < ema50:
        trend = "downtrend"
    else:
        trend = "sideways"

    if bb_width > 6 or atr / price * 100 > 3:
        volatility = "high"
    elif bb_width < 2:
        volatility = "low"
    else:
        volatility = "moderate"

    return {
        "price": float(price),
        "rsi": float(rsi),
        "macd": float(macd_line.iloc[-1]),
        "macd_signal": float(macd_signal.iloc[-1]),
        "macd_hist": float(macd_hist.iloc[-1]),
        "ema20": float(ema20),
        "ema50": float(ema50),
        "ema200": float(ema200),
        "sma20": float(sma20),
        "sma50": float(sma50),
        "bb_upper": float(bb_upper_v),
        "bb_lower": float(bb_lower_v),
        "bb_middle": float(bb_middle_v),
        "bb_width_pct": float(bb_width),
        "atr": float(atr),
        "atr_pct": float(atr / price * 100) if price else 0,
        "volume": float(volume.iloc[-1]),
        "volume_sma20": float(vol_sma) if not np.isnan(vol_sma) else 0,
        "volume_ratio": float(vol_ratio) if not np.isnan(vol_ratio) else 1.0,
        "trend": trend,
        "volatility": volatility,
    }
