"""
AI-assisted signal engine — rule-based ensemble with confidence calibration.
- No external AI provider receives secrets.
- Generates BUY/SELL/HOLD, confidence (0-100) and human-readable reasoning.
- Confidence is ensemble agreement + indicator strength; explicitly NOT P(profit).
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List

DISCLAIMER = "AI confidence reflects indicator agreement and volatility, not the probability of profit. Past signals do not guarantee future results."

def _score_rsi(rsi: float, trend: str) -> int:
    if rsi < 30:
        return +20  # oversold → buy bias
    if rsi > 70:
        return -20
    if 45 <= rsi <= 55 and trend == "sideways":
        return 0
    return 0

def _score_macd(macd: float, signal: float, hist: float) -> int:
    if macd > signal and hist > 0:
        # bullish momentum, weight by hist magnitude
        return +15 if hist > 0 else 0
    if macd < signal and hist < 0:
        return -15
    return 0

def _score_ema(price: float, ema20: float, ema50: float, ema200: float) -> int:
    score = 0
    if price > ema20 > ema50:
        score += 10
    elif price < ema20 < ema50:
        score -= 10
    if price > ema200:
        score += 5
    else:
        score -= 5
    return score

def _score_bb(price: float, bb_upper: float, bb_lower: float) -> int:
    if price <= bb_lower * 1.01:
        return +12  # near lower band — potential bounce
    if price >= bb_upper * 0.99:
        return -12
    return 0

def _score_volume(vol_ratio: float) -> int:
    if vol_ratio > 1.5:
        return 8  # high volume confirms move
    if vol_ratio < 0.6:
        return -4  # low volume — weak conviction
    return 0

def evaluate_signal(symbol: str, indicators: Dict, timeframe: str = "1h") -> Dict:
    """
    Returns dict matching SignalResponse schema.
    """
    price = indicators["price"]
    rsi = indicators["rsi"]
    macd = indicators["macd"]
    macd_sig = indicators["macd_signal"]
    macd_hist = indicators["macd_hist"]
    ema20, ema50, ema200 = indicators["ema20"], indicators["ema50"], indicators["ema200"]
    bb_u, bb_l = indicators["bb_upper"], indicators["bb_lower"]
    vol_ratio = indicators["volume_ratio"]
    trend = indicators["trend"]
    volatility = indicators["volatility"]
    atr_pct = indicators["atr_pct"]

    # Composite score -50..+50
    score = 0
    score += _score_rsi(rsi, trend)
    score += _score_macd(macd, macd_sig, macd_hist)
    score += _score_ema(price, ema20, ema50, ema200)
    score += _score_bb(price, bb_u, bb_l)
    score += _score_volume(vol_ratio)

    # Volatility penalty — reduce confidence in high-vol choppy markets
    vol_penalty = 0
    if volatility == "high":
        vol_penalty = 10
    elif volatility == "low" and abs(score) < 15:
        vol_penalty = 5  # low vol sideways — be cautious

    raw_confidence = min(95, max(5, abs(score) * 1.6 - vol_penalty))
    # Require minimum score threshold for actionable signals
    if abs(score) < 12:
        action = "HOLD"
        confidence = int(max(35, raw_confidence * 0.6))
    elif score > 0:
        action = "BUY"
        confidence = int(raw_confidence)
    else:
        action = "SELL"
        confidence = int(raw_confidence)

    # In high volatility, cap confidence
    if volatility == "high":
        confidence = min(confidence, 72)
    # RSI extremes cap at 78 (avoid overconfidence on reversal traps)
    if rsi < 25 or rsi > 75:
        confidence = min(confidence, 78)

    reasoning = _build_reasoning(symbol, action, score, indicators)

    return {
        "symbol": symbol,
        "action": action,
        "confidence": int(confidence),
        "price": price,
        "indicators": indicators,
        "reasoning": reasoning,
        "volatility": volatility,
        "trend": trend,
        "timeframe": timeframe,
        "generated_at": datetime.now(timezone.utc),
        "disclaimer": DISCLAIMER,
    }

def _build_reasoning(symbol: str, action: str, score: int, ind: Dict) -> str:
    parts: List[str] = []
    parts.append(f"Trend is {ind['trend'].replace('_',' ')} (EMA20 {ind['ema20']:.2f} vs EMA50 {ind['ema50']:.2f}).")
    if ind["rsi"] < 30:
        parts.append(f"RSI {ind['rsi']:.1f} shows oversold conditions.")
    elif ind["rsi"] > 70:
        parts.append(f"RSI {ind['rsi']:.1f} shows overbought conditions.")
    else:
        parts.append(f"RSI {ind['rsi']:.1f} is neutral.")

    if ind["macd_hist"] > 0:
        parts.append(f"MACD histogram {ind['macd_hist']:.3f} is positive (bullish momentum).")
    else:
        parts.append(f"MACD histogram {ind['macd_hist']:.3f} is negative (bearish momentum).")

    pos = "near upper Bollinger Band — potential resistance" if ind["price"] > ind["bb_upper"] * 0.99 else "near lower band — potential support" if ind["price"] < ind["bb_lower"] * 1.01 else "within Bollinger Bands"
    parts.append(f"Price is {pos}. Volatility is {ind['volatility']} (ATR {ind['atr_pct']:.2f}%, BB width {ind['bb_width_pct']:.2f}%).")
    parts.append(f"Volume ratio {ind['volume_ratio']:.2f}x vs 20-period average.")

    decision = {
        "BUY": f"Composite score {score:+d} suggests accumulation — consider BUY with strict stop-loss.",
        "SELL": f"Composite score {score:+d} suggests distribution — consider SELL / reduce exposure.",
        "HOLD": f"Composite score {score:+d} is below threshold — HOLD and wait for clearer setup.",
    }[action]

    parts.append(decision)
    parts.append("Confidence reflects indicator agreement under current volatility, not a guarantee of profit. Always verify balances, fees and exchange filters before ordering.")
    return " ".join(parts)

def batch_evaluate(symbols_indicators: Dict[str, Dict], timeframe: str = "1h") -> List[Dict]:
    return [evaluate_signal(sym, ind, timeframe) for sym, ind in symbols_indicators.items()]
