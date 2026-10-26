import os
import pytest

@pytest.fixture(autouse=True)
def set_env():
    # Ensure settings have required keys for tests
    from cryptography.fernet import Fernet
    os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
    os.environ.setdefault("JWT_SECRET", "test_jwt_secret_for_unit_tests_32chars")
    from app.core.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
