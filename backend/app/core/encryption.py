"""
Encryption helpers for Binance API secrets.
- Uses Fernet (AES-128-CBC + HMAC) with key from ENCRYPTION_KEY.
- Secrets are encrypted per-user at rest; plaintext only in memory for signing.
- Supports key rotation via re-encryption helper.
"""
from __future__ import annotations

import base64
import os
from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings


def _fernet() -> Fernet:
    key = get_settings().encryption_key
    # Validate format early
    try:
        Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        raise ValueError(
            "Invalid ENCRYPTION_KEY — generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
        ) from e
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        raise ValueError("Empty secret cannot be encrypted")
    token = _fernet().encrypt(plaintext.encode())
    return token.decode()


def decrypt_secret(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Failed to decrypt API secret — wrong ENCRYPTION_KEY?") from e


def mask_secret(secret: str) -> str:
    """Safe for logs/UI — never log full secret."""
    if not secret or len(secret) < 8:
        return "****"
    return secret[:4] + "****" + secret[-4:]


def generate_encryption_key() -> str:
    return Fernet.generate_key().decode()

# Helpers for key rotation (future)
def re_encrypt_all(old_key: str, new_key: str, tokens: list[str]) -> list[str]:
    old_f = Fernet(old_key.encode())
    new_f = Fernet(new_key.encode())
    out = []
    for t in tokens:
        plain = old_f.decrypt(t.encode())
        out.append(new_f.encrypt(plain).decode())
    return out
