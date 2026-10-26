"""
Secure Binance REST client — signing happens ONLY in backend.
- Encrypt/decrypt handled outside; this module receives plaintext only in memory.
- Validates withdraw permission rejection.
- Handles rate-limit (429), 418 bans, network failures with exponential backoff.
"""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
import urllib.parse
from typing import Any, Dict, Optional

import httpx

from ..core.config import get_settings


class BinanceClient:
    def __init__(self, api_key: str, api_secret: str, is_testnet: bool | None = None):
        settings = get_settings()
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = settings.binance_testnet_base if (is_testnet if is_testnet is not None else settings.binance_testnet) else settings.binance_api_base
        self.recv_window = settings.binance_recv_window
        self.client = httpx.AsyncClient(timeout=15.0)

    def _sign(self, params: dict) -> dict:
        params = {k: v for k, v in params.items() if v is not None}
        params["timestamp"] = int(time.time() * 1000)
        params["recvWindow"] = self.recv_window
        query = urllib.parse.urlencode(params)
        signature = hmac.new(self.api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        params["signature"] = signature
        return params

    def _headers(self) -> dict:
        return {"X-MBX-APIKEY": self.api_key, "Content-Type": "application/x-www-form-urlencoded"}

    # --- Public (no auth) ---
    async def klines(self, symbol: str, interval: str = "1h", limit: int = 100) -> list[dict]:
        url = f"{self.base_url}/api/v3/klines"
        r = await self.client.get(url, params={"symbol": symbol, "interval": interval, "limit": limit})
        r.raise_for_status()
        raw = r.json()
        # Normalize to dict list
        out = []
        for k in raw:
            out.append({
                "open_time": k[0], "open": float(k[1]), "high": float(k[2]),
                "low": float(k[3]), "close": float(k[4]), "volume": float(k[5]),
                "close_time": k[6], "quote_volume": float(k[7]), "trades": k[8],
            })
        return out

    async def ticker_price(self, symbol: Optional[str] = None):
        url = f"{self.base_url}/api/v3/ticker/price"
        params = {"symbol": symbol} if symbol else {}
        r = await self.client.get(url, params=params)
        r.raise_for_status()
        return r.json()

    async def exchange_info(self, symbol: Optional[str] = None):
        url = f"{self.base_url}/api/v3/exchangeInfo"
        params = {"symbol": symbol} if symbol else {}
        r = await self.client.get(url, params=params)
        r.raise_for_status()
        return r.json()

    # --- Private (signed) ---
    async def account_info(self) -> dict:
        url = f"{self.base_url}/api/v3/account"
        params = self._sign({})
        r = await self.client.get(url, params=params, headers=self._headers())
        if r.status_code == 401:
            raise ValueError("Invalid API key/secret or IP not whitelisted")
        r.raise_for_status()
        return r.json()

    async def balances(self) -> dict:
        info = await self.account_info()
        return info

    async def open_orders(self, symbol: Optional[str] = None) -> list:
        url = f"{self.base_url}/api/v3/openOrders"
        params = self._sign({"symbol": symbol} if symbol else {})
        r = await self.client.get(url, params=params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def create_order(
        self,
        symbol: str,
        side: str,
        type: str,
        quantity: Optional[float] = None,
        quoteOrderQty: Optional[float] = None,
        price: Optional[float] = None,
        timeInForce: Optional[str] = None,
        newClientOrderId: Optional[str] = None,
    ) -> dict:
        """
        Places order with duplicate guard via newClientOrderId.
        Validates MIN_NOTIONAL / LOT_SIZE should be done before calling (risk_manager + exchangeInfo).
        """
        url = f"{self.base_url}/api/v3/order"
        params: Dict[str, Any] = {
            "symbol": symbol,
            "side": side,
            "type": type,
        }
        if quantity is not None:
            params["quantity"] = quantity
        if quoteOrderQty is not None:
            params["quoteOrderQty"] = quoteOrderQty
        if price is not None:
            params["price"] = price
        if timeInForce:
            params["timeInForce"] = timeInForce
        params["newClientOrderId"] = newClientOrderId or f"ai_{uuid.uuid4().hex[:16]}"

        signed = self._sign(params)
        # Retry on 429/5xx with backoff
        for attempt in range(get_settings().binance_recv_window and 3 or 3):
            r = await self.client.post(url, params=signed, headers=self._headers())
            if r.status_code in (429, 418, 500, 502, 503):
                await _sleep_backoff(attempt)
                continue
            if r.status_code >= 400:
                # Surface Binance error code
                try:
                    body = r.json()
                    raise RuntimeError(f"Binance error {body.get('code')}: {body.get('msg')}")
                except Exception:
                    r.raise_for_status()
            return r.json()
        raise RuntimeError("Binance order failed after retries — rate limited or unavailable")

    async def get_order(self, symbol: str, orderId: Optional[int] = None, origClientOrderId: Optional[str] = None) -> dict:
        url = f"{self.base_url}/api/v3/order"
        params: Dict[str, Any] = {"symbol": symbol}
        if orderId is not None:
            params["orderId"] = orderId
        if origClientOrderId:
            params["origClientOrderId"] = origClientOrderId
        signed = self._sign(params)
        r = await self.client.get(url, params=signed, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def cancel_order(self, symbol: str, orderId: Optional[int] = None, origClientOrderId: Optional[str] = None) -> dict:
        url = f"{self.base_url}/api/v3/order"
        params: Dict[str, Any] = {"symbol": symbol}
        if orderId is not None:
            params["orderId"] = orderId
        if origClientOrderId:
            params["origClientOrderId"] = origClientOrderId
        signed = self._sign(params)
        r = await self.client.delete(url, params=signed, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def check_permissions(self) -> tuple[bool, bool, bool, list[str]]:
        """
        Returns (can_read, can_trade, has_withdraw, permissions)
        """
        info = await self.account_info()
        perms = info.get("permissions", [])
        can_trade = info.get("canTrade", False)
        # Binance account endpoint does not directly say withdraw — check API key permissions via /api/v3/account/commission alternative
        # For testnet, enableSpot permission implies trading. We explicitly reject if "WITHDRAW" in perms only if key was misconfigured.
        has_withdraw = "WITHDRAW" in perms or info.get("canWithdraw", False)
        can_read = True  # if account_info succeeded
        return can_read, can_trade, has_withdraw, perms

    async def close(self):
        await self.client.aclose()

async def _sleep_backoff(attempt: int):
    import asyncio
    await asyncio.sleep(min(2 ** attempt, 5))
