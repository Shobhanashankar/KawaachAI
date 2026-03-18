## KawaachAI — Parametric Income Insurance for Q-Commerce Delivery Workers

## The Problem

Ravi delivers groceries for Zepto in Bengaluru. Last monsoon, 4 days of heavy rain halted all deliveries in his zone. He lost ₹5,400 in wages — no refund, no compensation, no safety net. He had no insurance. Neither did any of his 847,000 fellow Q-commerce delivery workers across India.

Platform-based delivery workers lose **20–30% of monthly earnings** to uncontrollable external disruptions — extreme rain, toxic AQI, cyclones, civic curfews, and platform outages. No product exists to protect their income against these events. Until now.

**KawaachAI** is a cloud-native, zero-touch parametric income insurance platform. When an external disruption crosses a verified threshold, the platform auto-detects the event, raises a claim inside Guidewire ClaimCenter, and credits lost wages to the worker's UPI ID — **in under 500 milliseconds, with zero worker action required.**

---

## Scope — What We Cover (and What We Don't)

| ✅ Covered | ❌ Explicitly Excluded |
|---|---|
| Lost income during verified external disruptions | Health / medical expenses |
| Weekly premium ₹49–₹99 aligned to payout cycle | Vehicle repair or maintenance |
| Parametric payouts — no paperwork, no adjuster | Accident compensation |
| Q-Commerce workers only (Zepto / Blinkit) | Life insurance |

> **Golden Rule:** We insure the *income lost*, not the disruption itself. Every payout is a % of the worker's daily wage — nothing more.

---

## Persona — Who We're Building For

**Zepto and Blinkit delivery workers** are the highest-disruption segment in Indian gig work:

- Operate on **10-minute delivery SLAs** — a 2-hour rain halt costs 12+ deliveries and ₹300–600
- **Dark-store tethered** — assigned to a single fulfilment zone, cannot shift to a safer area when disruption hits
- Earn **₹350–600/day**, 6 days/week — no paid leave, no sick pay, no income buffer
- **Smartphone-native** — UPI, WhatsApp, and app-based workflows are their default operating environment
- **Language-diverse** — majority comfortable in Hindi, Kannada, Tamil, or Telugu; not English

### Persona Scenarios

**Scenario 1 — Ravi, Bengaluru (Rain trigger)**
> IMD reports 88mm rainfall in 24 hours in zone BLR-H3-07 (Koramangala). Threshold: >75mm. KawaachAI trigger fires at 6:14 AM. Ravi's GPS confirms he is in the zone. Fraud checks pass in 48ms. ClaimCenter FNOL submitted via Cloud API. ₹450 UPI credit hits Ravi's phone at 6:14:00.487 AM. Total time: 487ms.

**Scenario 2 — Priya, Delhi (AQI trigger)**
> CPCB sensor reports AQI 342 in zone DEL-H3-12 (Connaught Place) for 3+ hours. Threshold: >300 sustained. KawaachAI auto-claims for all 312 active policyholders in the zone. Payout: 100% daily wage (₹480) each. Zero workers filed a claim manually.

**Scenario 3 — Kiran, Mumbai (Curfew trigger)**
> Municipal corporation issues emergency curfew in zone MUM-H3-09 (Dharavi) at 2 PM. Civic webhook fires within 8 minutes. All 91 active policyholders in zone auto-notified and auto-claimed. Payout: 75% daily wage for remaining working hours.

---

## How It Works — End-to-End Flow

```
External Disruption (Rain / AQI / Wind / Curfew / Platform Downtime)
        │
        ▼
Trigger Monitor (Apache Flink + IMD/CPCB/OpenWeather APIs)
        │  Threshold breached in H3 zone
        ▼
Kafka Event → disruption-events topic
        │
        ▼
Claims Service ──► Fraud Engine (6-layer, <50ms)
        │                    │
        │              [GPS zone check]
        │              [Dedup Redis lock]
        │              [API cross-validation]
        │              [Isolation Forest score]
        │              [Device fingerprint]
        │              [SafeRider trust score]
        │
        ▼  (all 6 layers pass)
Guidewire ClaimCenter — FNOL via Cloud API
        │  Claim status: Draft → Approved (<3s)
        ▼
Payout Service → Razorpay UPI Payout API
        │
        ▼
Worker receives ₹ credit + FCM push notification
        
Total pipeline: < 500ms
```

---

## Weekly Premium Model

Gig workers earn and are paid weekly. Aligning premiums to their Monday Zepto/Blinkit payout eliminates the affordability barrier — the worker never pre-pays from savings.

### Premium Formula

```
weekly_premium = max(₹49, base_premium × zone_risk_multiplier − discounts)

where:
  base_premium         = 0.04 × daily_wage_estimate × 7
  zone_risk_multiplier = XGBoost zone score (range: 0.8 – 1.4)
                         based on 18-month historical disruption data per H3 hex
  discounts            = SafeRider loyalty discount (up to −24%)
                       + Dost Shield group discount (−10% if in squad pool)

premium cap: ₹99/week
premium floor: ₹49/week
```

### Example Calculation

| Worker | Zone | Daily Wage | Base | Zone Multiplier | Discount | Final |
|---|---|---|---|---|---|---|
| Ravi, BLR | High flood risk | ₹450 | ₹63 | ×1.3 | −₹2 (new user) | **₹79/week** |
| Priya, DEL | Medium AQI risk | ₹480 | ₹67 | ×1.1 | −₹8 (SafeRider Tier 3) | **₹66/week** |
| Kiran, MUM | Low risk zone | ₹420 | ₹59 | ×0.9 | −₹6 | **₹49/week** (floor) |

### Why Weekly?
Zepto and Blinkit pay partners every Monday. Premiums are deducted the same day via UPI AutoPay mandate — zero friction, zero advance payment from savings.

---

## 5 Parametric Triggers

All triggers fire **automatically** — no worker action required. Each threshold is calibrated to represent a genuine income-loss event for Q-commerce delivery.

| # | Trigger | Data Source | Threshold | Hours Lost | Payout |
|---|---|---|---|---|---|
| 1 | Heavy rain (moderate) | IMD Open API | >75mm / 24hr in H3 zone | 4–6 hours | 50% daily wage |
| 2 | Heavy rain (severe) | IMD Open API | >100mm / 24hr in H3 zone | Full day | 100% daily wage |
| 3 | Hazardous AQI | CPCB Real-time API | AQI >300 sustained >3 hrs | Full day | 100% daily wage |
| 4 | Cyclone / high wind | OpenWeather API | Wind >60 kmph sustained | Full day | 100% daily wage |
| 5 | Civic curfew / zone closure | Mock Govt webhook | Official curfew flag in zone | Remaining hours | 75% daily wage |
| 6 | Platform downtime | Mocked webhook | Zepto/Blinkit down >2 hrs | 2–4 hours | 40% daily wage |

**Max claim per week:** 3 disrupted days (3 × daily wage)  
**Cross-validation rule:** Disruption must be confirmed by ≥2 of 3 independent data sources before trigger fires

---

## AI & ML Integration

### 1. XGBoost Dynamic Premium Engine
- **Input:** 14-feature vector per worker (zone flood history, AQI index, wind exposure, claim history, SafeRider score, active hours, dark store cluster density, monsoon season flag, and 6 more)
- **Output:** Weekly premium amount + SHAP feature importance breakdown
- **Why SHAP?** Every premium is explainable. Worker sees: *"Your premium is ₹79 this week — ₹12 higher than base because your zone had 3 flood events in the last 90 days."* No black-box pricing.

### 2. Isolation Forest Fraud Detection
- **Input:** 30-day rolling feature vector per worker (claim frequency, GPS zone match rate, timing patterns, device consistency)
- **Output:** Anomaly score 0–1. Score >0.72 = flagged for review
- **Inference latency:** <35ms
- **Training:** Scikit-learn on synthetic + historical claim data. Retrained weekly.

### 3. LSTM Disruption Forecast
- **Input:** 18-month weather + AQI time-series per H3 hexagon
- **Output:** 72-hour disruption probability per zone, updated every 6 hours
- **Usage:** Powers the daily *Disruption Forecast* push notification at 6 AM
- *"73% rain probability in your zone today. Consider upgrading coverage for ₹12 extra this week."*

### 4. MLOps Pipeline
- MLflow for experiment tracking and model registry
- Kubeflow Pipelines for automated retraining (triggered on model drift >2%)
- Canary deployments for new model versions — no big-bang releases

---

## Tech Stack

### Platform Choice: Mobile (React Native)
Workers are smartphone-native. UPI, FCM push notifications, GPS location, and Aadhaar eKYC are all mobile-native capabilities. A web app would add friction for workers who don't use laptops. React Native gives us a single codebase for iOS + Android.

### Full Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile app | React Native (Expo) | iOS + Android. Native UPI/FCM/GPS. Offline-first. |
| Admin dashboard | React + Vite + Mapbox GL | Risk heatmap rendering, ClickHouse data via REST |
| API gateway | Kong on Kubernetes | Rate limiting, JWT auth, plugin ecosystem |
| Microservices | Node.js (TypeScript) + gRPC | 5 independent services: Worker, Premium, Trigger, Claims, Payout |
| ML inference | Python (FastAPI) + KServe | XGBoost, Isolation Forest, LSTM as K8s-native model endpoints |
| Event streaming | Apache Kafka (Strimzi) | Immutable event log: disruption-events, claims-pipeline, payout-events topics |
| Stream processing | Apache Flink | Real-time feature engineering, 5-min zone polling, rolling fraud vectors |
| Transactional DB | PostgreSQL 16 + PostGIS | Workers, policies, claims. ST_DWithin for GPS fraud checks |
| Time-series DB | TimescaleDB | Weather/AQI hypertables partitioned by zone + hour |
| Cache | Redis Cluster | Sessions, ML feature cache, SETNX deduplication locks |
| Data lake | Apache Iceberg on S3 | Raw event archive, ML training datasets |
| Analytics | ClickHouse | Sub-second loss ratio aggregations for insurer dashboard |
| MLOps | MLflow + Kubeflow | Experiment tracking, model registry, automated retraining |
| Infrastructure | Kubernetes (GKE) + KEDA | HPA pod scaling, Kafka-lag-driven autoscaling via KEDA |
| Observability | Prometheus + Grafana + Jaeger | Metrics, dashboards, distributed tracing |
| Secrets | HashiCorp Vault | API keys injected via Vault Agent sidecar — never hardcoded |
| Payments (mock) | Razorpay Payout API (sandbox) | UPI payouts in test mode |
| Notifications | FCM + WhatsApp Business API | Push + messaging in worker's language |
| CI/CD | GitHub Actions + ArgoCD | GitOps: merge to main → build → test → K8s deploy |

### Guidewire Integration — Core Differentiator

Most teams will build claim logic outside Guidewire. We don't.

| Component | Usage |
|---|---|
| **Advanced Product Designer (APD)** | Define the LOB, coverages (income loss only), and explicit exclusions (no health/vehicle) |
| **PolicyCenter Cloud API** | Weekly policy creation, renewal, cancellation via REST |
| **ClaimCenter Cloud API** | Automated FNOL submission: `POST /claims` with trigger metadata, zone ID, payout amount |
| **Application Events** | ClaimCenter broadcasts `claim.approved` → downstream Payout Service consumes and fires UPI |
| **Integration Gateway (Apache Camel)** | Polls IMD/CPCB APIs, normalizes JSON, feeds Trigger Monitor |

---

## Spatial Intelligence — Uber H3 Hexagonal Grid

We use **Uber H3 at Resolution 9** (~500m hexagon diameter) for all zone-based operations.

**Why H3 over postal codes or districts?**
- Postal codes in India can span 5–15km — too coarse for micro-weather events
- H3 resolution 9 gives us 500m precision — enough to distinguish a waterlogged street from a dry one 400m away
- H3 hexagons tile perfectly with no overlap — no ambiguity about which zone a GPS coordinate belongs to
- All 6 fraud checks, all 5 triggers, and all premium calculations operate at H3 resolution

---

## 6-Layer Fraud Defense Stack

Running in parallel, combined latency <50ms:

| Layer | Technology | What It Catches | SLA |
|---|---|---|---|
| 1. Geospatial validation | PostGIS ST_DWithin | GPS outside triggered H3 hexagon (GPS spoofing) | <10ms |
| 2. Deduplication | Redis SETNX lock | Multiple claims per worker per event | <5ms |
| 3. Source verification | 2/3 API consensus | Single rogue data source falsely triggering payout | <20ms |
| 4. Behavioural ML | Isolation Forest (score >0.72) | Unusual claim patterns, bot behaviour, timing anomalies | <35ms |
| 5. Identity check | Device fingerprint vs eKYC VPA | New device requesting payout (SIM swap / impersonation) | <10ms |
| 6. Loyalty signal | SafeRider Score tiers 1–5 | High-trust workers get fast-track; low-trust get extra checks | <5ms |

**Business case:** This stack reduces illegitimate claims by ~70%, bringing the raw loss ratio from 300%+ down to a commercially viable 94–96%.

---

## Novelty Features

### 1. Disruption Forecast — Daily Earnings Weather Report
LSTM model generates a 72-hour disruption probability per H3 zone. Every worker receives a 6 AM push notification: *"73% rain risk in your zone today. Consider upgrading to Premium Shield for ₹12 extra this week."* Transforms the app from passive safety net into a daily operational tool. No product in India currently offers this to gig workers.

### 2. SafeRider Score — Loyalty Lowers Your Premium
5-tier trust and loyalty system. Workers earn score by maintaining continuous weekly coverage, filing zero fraudulent claims, and staying active. Each tier unlocks a 6% premium discount. At Tier 5 ("Champion"), the worker pays the minimum ₹49/week regardless of zone risk. Premium discount is visible in-app with a progress bar.

| Tier | Label | Premium Discount | Fraud Check |
|---|---|---|---|
| 1 | New | 0% | Standard |
| 2 | Growing | −6% | Standard |
| 3 | Regular | −12% | Reduced |
| 4 | Trusted | −18% | Minimal |
| 5 | Champion | −24% (floor ₹49) | Fast-track |

### 3. Dost Shield — Squad Pooling (Micro-Mutual Insurance)
Groups of 5–10 workers from the same dark store voluntarily pool together. If no one in the group files a claim in a given week, every member receives 10% premium cashback the following Monday — coinciding with their Zepto payout. Social accountability reduces fraud. Community cohesion is a side effect.

### 4. Impact Widget — "What Insurance Did For You"
Home screen widget: *"This month, you would have lost ₹2,100 without KawaachAI. You paid ₹196 in premiums. Net gain: ₹1,904."* Updated after every trigger event. The most powerful retention and referral tool in the product — makes the abstract value of insurance viscerally concrete.

### 5. Vernacular UI + LLM Chatbot
App supports Hindi, Kannada, Tamil, and Telugu. Language auto-detected from phone locale on first launch. All notifications, WhatsApp messages, and payout receipts in the worker's chosen language. LLM chatbot (Claude / Gemini API) handles onboarding in natural language colloquialisms — a worker can type *"bhai aaj policy kab milegi"* and get a proper answer.

---

## Business Viability

### Unit Economics (Single Worker, Bengaluru)

| Metric | Conservative | Optimistic |
|---|---|---|
| Weekly premium | ₹49 | ₹79 |
| Annual revenue | ₹2,548 | ₹4,108 |
| Disruption days/year | 18 | 28 |
| Raw loss ratio | 318% | 327% |
| **Post fraud-stack loss ratio** | **95%** | **98%** |

### Regulatory Path
- **IRDAI Micro-Insurance Guidelines 2023:** Premium <₹100/week qualifies as micro-insurance
- **IRDAI Regulatory Sandbox 2019:** Enables a 2-year pilot without a full insurance license
- **Social Security Code (effective Nov 2025):** Mandates gig worker protections — only 40% of platforms currently compliant
- **Delhi Ordinance (Feb 2026):** Mandates heatstroke insurance for delivery workers

### Market Size
- 7.7M gig workers today → **23.5M by 2030** (NITI Aayog, 2022)
- 1% penetration = 235,000 weekly subscribers = **₹11.5–18.5 crore/year in premium revenue**

---

## References

| Topic | Source |
|---|---|
| Gig worker vulnerability | NITI Aayog: *India's Booming Gig and Platform Economy* (2022) |
| Worker conditions | Fairwork India Report 2023–2024 |
| Parametric insurance | Geneva Association: *Parametric Insurance: A Primer* |
| Parametric vs indemnity | Investopedia |
| IRDAI regulation | IRDAI Sandbox Regulations 2019 + Micro-Insurance Guidelines 2023 |
| AI in insurance | McKinsey: *Insurance 2030 — The Impact of AI* |
| Fraud detection ML | IEEE / Towards Data Science: anomaly detection in insurance claims |
| Weather data | IMD Open API (rainfall), CPCB Real-time API (AQI), OpenWeather API |
| Spatial indexing | Uber H3 documentation — h3geo.org |
| Guidewire APIs | developer.guidewire.com — ClaimCenter + PolicyCenter REST API docs |

---

*KawaachAI — From rain threshold breach to UPI credited in under 500 milliseconds.*  
