import pytest
import hmac, hashlib, urllib.parse
from unittest.mock import AsyncMock, MagicMock

def test_signing():
    from app.services.binance_client import BinanceClient
    client = BinanceClient(api_key="testkey", api_secret="testsecret", is_testnet=True)
    params = client._sign({"symbol": "BTCUSDT"})
    assert "timestamp" in params
    assert "signature" in params
    assert params["recvWindow"]==5000
    # Verify signature is valid hex 64 chars
    assert len(params["signature"])==64
    # All hex
    int(params["signature"],16)

@pytest.mark.asyncio
async def test_binance_client_rate_limit_retry(monkeypatch):
    from app.services.binance_client import BinanceClient
    client = BinanceClient(api_key="k", api_secret="s", is_testnet=True)
    # Mock httpx client to fail then succeed
    call_count=[0]
    async def mock_post(*args, **kwargs):
        call_count[0]+=1
        mock=MagicMock()
        if call_count[0]==1:
            mock.status_code=429
            mock.json=lambda: {}
        else:
            mock.status_code=200
            mock.json=lambda: {"orderId":123,"status":"NEW"}
        return mock
    client.client.post = mock_post
    client._sign = lambda p: {**p, "signature":"sig","timestamp":123,"recvWindow":5000}
    client.client.get = AsyncMock()
    # create_order should retry
    # Patch sleep
    import app.services.binance_client as bc
    bc._sleep_backoff = AsyncMock()
    res = await client.create_order(symbol="BTCUSDT", side="BUY", type="MARKET", quantity=0.001)
    assert res["orderId"]==123
    assert call_count[0]==2

def test_encryption_roundtrip():
    # Ensure Fernet works
    import os
    os.environ["ENCRYPTION_KEY"]="testkey_not_used"
    from cryptography.fernet import Fernet
    key=Fernet.generate_key().decode()
    os.environ["ENCRYPTION_KEY"]=key
    # Need to reload settings cache
    from app.core.config import get_settings
    get_settings.cache_clear()
    from app.core.encryption import encrypt_secret, decrypt_secret
    # re-init with new key
    secret="my_binance_secret_123XYZ"
    token=encrypt_secret(secret)
    assert token != secret
    assert decrypt_secret(token)==secret
    get_settings.cache_clear()
