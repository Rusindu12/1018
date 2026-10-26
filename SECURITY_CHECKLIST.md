# Pre-Production Security Checklist

- [ ] Rotate ENCRYPTION_KEY and JWT_SECRET from examples
- [ ] Binance keys have ONLY Spot Trading + Reading, no Withdrawal, IP whitelist set
- [ ] Backend test: /binance/test-connection returns success=true, has_withdraw=false
- [ ] Paper trading validated over 7+ days, P&L plausible
- [ ] Risk limits set and tested (daily loss, cooldown, max positions)
- [ ] Emergency STOP tested end-to-end
- [ ] No secrets in git log, APK strings, or crash reports (run gitleaks + apktool check)
- [ ] HTTPS enforced, CORS locked, rate limits active
- [ ] Structured logging without secrets confirmed
- [ ] Dependency audit (pip-audit, gradle dependencyCheck)
