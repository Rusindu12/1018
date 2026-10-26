#!/usr/bin/env bash
set -e
export ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
export JWT_SECRET="test_jwt_secret_for_unit_tests_32chars"
pytest -v --cov=app "$@"
