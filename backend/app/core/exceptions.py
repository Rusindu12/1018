from fastapi import HTTPException, status

class BinanceError(HTTPException):
    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(status_code=status_code, detail=detail)

class RiskLimitExceeded(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=422, detail=detail)

class TradingModeError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=403, detail=detail)

class DuplicateOrderError(HTTPException):
    def __init__(self, detail: str = "Duplicate order — idempotency key already used"):
        super().__init__(status_code=409, detail=detail)
