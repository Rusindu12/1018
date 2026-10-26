from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..core.database import get_db
from ..core.security import get_current_user_id
from ..core.encryption import encrypt_secret, decrypt_secret, mask_secret
from ..models.api_credential import ApiCredential
from ..schemas.binance import BinanceCredentialCreate, BinanceCredentialOut, ConnectionTestResult, BalanceResponse, BalanceAsset
from ..services.binance_client import BinanceClient

router = APIRouter()

def _mask_key(enc_key: str) -> str:
    try:
        plain = decrypt_secret(enc_key)
        return mask_secret(plain)
    except Exception:
        return "****"

@router.post("/credentials", response_model=BinanceCredentialOut)
async def save_credentials(
    payload: BinanceCredentialCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # Enforce no withdrawal confusion — we never ask for withdrawal, but validate after test
    enc_key = encrypt_secret(payload.api_key)
    enc_secret = encrypt_secret(payload.api_secret)
    # Upsert by user+label
    res = await db.execute(select(ApiCredential).where(ApiCredential.user_id==user_id, ApiCredential.label==payload.label))
    existing = res.scalar_one_or_none()
    if existing:
        existing.encrypted_api_key = enc_key
        existing.encrypted_api_secret = enc_secret
        existing.is_testnet = payload.is_testnet
        existing.is_active = True
        await db.flush()
        return BinanceCredentialOut(
            id=existing.id, label=existing.label, is_testnet=existing.is_testnet,
            is_active=existing.is_active, masked_api_key=mask_secret(payload.api_key),
            can_trade=existing.can_trade, can_read=existing.can_read, last_verified_at=existing.last_verified_at
        )
    cred = ApiCredential(
        user_id=user_id, encrypted_api_key=enc_key, encrypted_api_secret=enc_secret,
        label=payload.label, is_testnet=payload.is_testnet
    )
    db.add(cred)
    await db.flush()
    return BinanceCredentialOut(id=cred.id, label=cred.label, is_testnet=cred.is_testnet, is_active=True, masked_api_key=mask_secret(payload.api_key))

@router.get("/credentials", response_model=list[BinanceCredentialOut])
async def list_credentials(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ApiCredential).where(ApiCredential.user_id==user_id))
    rows = res.scalars().all()
    return [
        BinanceCredentialOut(
            id=r.id, label=r.label, is_testnet=r.is_testnet, is_active=r.is_active,
            masked_api_key=_mask_key(r.encrypted_api_key), can_trade=r.can_trade, can_read=r.can_read, last_verified_at=r.last_verified_at
        ) for r in rows
    ]

@router.post("/test-connection", response_model=ConnectionTestResult)
async def test_connection(
    credential_id: str | None = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # Find credential
    q = select(ApiCredential).where(ApiCredential.user_id==user_id, ApiCredential.is_active==True)
    if credential_id:
        q = q.where(ApiCredential.id==credential_id)
    res = await db.execute(q)
    cred = res.scalars().first()
    if not cred:
        raise HTTPException(status_code=404, detail="No active Binance credential found. Add API Key/Secret in Settings.")
    api_key = decrypt_secret(cred.encrypted_api_key)
    api_secret = decrypt_secret(cred.encrypted_api_secret)
    client = BinanceClient(api_key=api_key, api_secret=api_secret, is_testnet=cred.is_testnet)
    try:
        can_read, can_trade, has_withdraw, perms = await client.check_permissions()
        # Enforce withdrawal permission rejection
        if has_withdraw:
            return ConnectionTestResult(
                success=False, can_read=can_read, can_trade=can_trade,
                has_withdraw_permission=True, message="Security violation: API key has WITHDRAW permission. Create a new key with ONLY Spot Trading (Read + Trading) and disable Withdrawals.", permissions=perms
            )
        if not can_trade:
            return ConnectionTestResult(success=False, can_read=can_read, can_trade=False, has_withdraw_permission=False, message="API key lacks trading permission. Enable 'Enable Trading' on Binance API management.", permissions=perms)
        # Fetch balances on success
        info = await client.account_info()
        cred.can_read = can_read; cred.can_trade = can_trade; cred.last_verified_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
        await db.flush()
        return ConnectionTestResult(
            success=True, can_read=True, can_trade=True, has_withdraw_permission=False,
            message="Connection verified. Trading permission confirmed; withdrawal correctly disabled.",
            permissions=perms, account_type=info.get("accountType")
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Binance connection failed: {str(e)[:500]}")
    finally:
        await client.close()

@router.get("/balances", response_model=BalanceResponse)
async def get_balances(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    # Try live Binance first; fallback to paper positions
    res = await db.execute(select(ApiCredential).where(ApiCredential.user_id==user_id, ApiCredential.is_active==True))
    cred = res.scalars().first()
    if cred and cred.can_trade:
        try:
            api_key = decrypt_secret(cred.encrypted_api_key)
            api_secret = decrypt_secret(cred.encrypted_api_secret)
            client = BinanceClient(api_key=api_key, api_secret=api_secret, is_testnet=cred.is_testnet)
            info = await client.account_info()
            await client.close()
            balances = []
            total = 0.0
            avail = 0.0
            for b in info.get("balances", []):
                free = float(b["free"]); locked = float(b["locked"])
                if free == 0 and locked == 0:
                    continue
                balances.append(BalanceAsset(asset=b["asset"], free=free, locked=locked, total=free+locked))
                if b["asset"] == "USDT":
                    avail = free; total = free + locked
            return BalanceResponse(balances=balances, total_usdt=total, available_usdt=avail, source="binance")
        except Exception as e:
            pass  # fallback to paper

    # Paper fallback — compute from positions + initial balance
    from ..models.trade import Position
    from ..core.config import get_settings
    res = await db.execute(select(Position).where(Position.user_id==user_id))
    positions = res.scalars().all()
    # Paper ledger: USDT = initial - cost + realized
    initial = get_settings().paper_initial_balance_usdt
    invested = sum(p.quantity * p.avg_entry_price for p in positions)
    realized = sum(p.realized_pnl for p in positions)
    # approximate prices via market ticks unavailable here — use stored avg
    balances = [BalanceAsset(asset="USDT", free=max(0, initial - invested + realized), locked=0, total=max(0, initial - invested + realized))]
    for p in positions:
        if p.quantity > 0:
            balances.append(BalanceAsset(asset=p.base_asset, free=p.quantity, locked=0, total=p.quantity))
    return BalanceResponse(balances=balances, total_usdt=balances[0].total, available_usdt=balances[0].free, source="paper")

@router.delete("/credentials/{cred_id}")
async def delete_credential(cred_id: str, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(ApiCredential).where(ApiCredential.id==cred_id, ApiCredential.user_id==user_id))
    cred = res.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")
    await db.delete(cred)
    await db.flush()
    return {"deleted": cred_id}
