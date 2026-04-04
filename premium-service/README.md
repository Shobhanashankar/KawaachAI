# KawaachAI — premium-service (SPEC-03)

Node.js / TypeScript microservice handling Premium Engine, SafeRider Score, Dost Shield, and Razorpay UPI integration for the KawaachAI parametric income insurance platform.

## Port: 3003

---

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Start PostgreSQL (with PostGIS) and Kafka locally:
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgis/postgis:16-3.4
docker run -d --name kafka -p 9092:9092 apache/kafka:latest

# 4. Run in development
npm run dev

# 5. Run tests
npm test
```

---

## API Reference

### Workers
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/workers` | Onboard a new worker |
| GET | `/api/v1/workers/:id` | Get worker profile |
| GET | `/api/v1/workers/:id/premium` | Get premium breakdown with SHAP |
| POST | `/api/v1/workers/:id/mandate` | Create UPI AutoPay mandate |
| GET | `/api/v1/workers/:id/fraud-threshold` | Get SafeRider fraud threshold |
| POST | `/api/v1/workers/:id/fraud-flag` | Apply fraud flag (drops tier) |

### Squads
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/squads` | Form a Dost Squad |
| GET | `/api/v1/squads` | List active squads |
| GET | `/api/v1/squads/:id` | Squad details + members |
| POST | `/api/v1/squads/cashback/run` | Trigger cashback manually (admin) |

### Payouts
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/payouts` | Initiate a payout |
| GET | `/api/v1/payouts/idempotency/:key` | Check by idempotency key |
| POST | `/api/v1/payouts/deductions/run` | Trigger weekly deductions (admin) |

### Webhooks
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/webhooks/razorpay` | Razorpay payout webhook |
| POST | `/api/v1/webhooks/mandate` | Razorpay mandate webhook |

---

## Premium Formula

```
base          = daily_wage_est × 7 × 0.02
zone_adjusted = base × zone_multiplier     (ML model or default 1.0)
after_sr      = zone_adjusted × (1 − saferider_discount_pct)
after_dost    = after_sr − dost_flat_discount
final         = min(99, max(49, round(after_dost)))
```

## SafeRider Tiers

| Tier | Min Weeks | Discount | Fraud Threshold |
|------|-----------|----------|-----------------|
| 1 New | 0 | 0% | 0.72 |
| 2 Growing | 4 | 6% | 0.72 |
| 3 Regular | 12 | 12% | 0.72 |
| 4 Trusted | 24 | 18% | **0.85** |
| 5 Champion | 52 | 24% | **0.85** |

Fraud flag: consecutive_weeks reset to 0, tier drops by 1 (min Tier 1).

## Kafka Topics

| Direction | Topic | Description |
|-----------|-------|-------------|
| Consume | `claims.approved` | Triggers claim payout |
| Produce | `payouts.completed` | After payout confirmed |
| Produce | `saferider.tier_changed` | After tier promotion/demotion |

## Crons (UTC)

| Schedule | Job |
|----------|-----|
| `30 0 * * 1` (Mon 06:00 IST) | Weekly premium deduction |
| `30 1 * * 1` (Mon 07:00 IST) | Dost Shield cashback |

---

## Kubernetes Deployment

```bash
# Create secrets
kubectl create secret generic premium-service-secrets \
  --from-literal=db-user=postgres \
  --from-literal=db-password=CHANGEME \
  --from-literal=razorpay-key-id=rzp_test_XXXXX \
  --from-literal=razorpay-key-secret=XXXXXXXX \
  --from-literal=razorpay-webhook-secret=XXXXXXXX \
  --from-literal=razorpay-account-number=XXXXXXXXXX \
  -n kawaachai

# Deploy
helm upgrade --install premium-service ./helm \
  -f helm/values.yaml \
  -n kawaachai \
  --create-namespace
```