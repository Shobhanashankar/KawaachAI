# KawaachAI — Parametric Income Insurance for Q-Commerce Delivery Workers

> **Guidewire DEVTrails 2026** · Persona: Q-Commerce (Zepto & Blinkit) · Phase 1 — March 20, 2026

---

## The Problem

Ravi delivers groceries for Zepto in Bengaluru. Last monsoon, 4 days of heavy rain halted all deliveries in his zone. He lost ₹5,400 in wages — no refund, no compensation, no safety net. He had no insurance. Neither did any of his fellow Q-commerce delivery workers.

Platform-based gig workers lose an estimated **20–30% of monthly earnings** to uncontrollable external disruptions — extreme rain, toxic AQI, cyclones, and civic curfews. India's gig workforce stands at 7.7 million today and is projected to reach 23.5 million by 2030 (NITI Aayog, 2022). The majority carry no income protection against these events.

**KawaachAI** is a parametric income insurance platform for Zepto and Blinkit delivery workers. The design principle is simple: don't build a claim-after-loss tool — build a protect-before-loss platform. When an external disruption crosses a verified threshold, the system auto-detects the event, raises a claim in Guidewire ClaimCenter, and credits lost wages to the worker's UPI ID with zero manual action required.

---

## Scope — What We Cover (and What We Don't)

| ✅ Covered | ❌ Explicitly Excluded |
|---|---|
| Lost income during verified external disruptions | Health / medical expenses |
| Weekly premiums ₹49–₹99 aligned to payout cycle | Vehicle repair or maintenance |
| Parametric payouts — no paperwork, no adjuster | Accident compensation |
| Q-Commerce workers only (Zepto / Blinkit) | Life insurance |

> **Golden Rule:** We insure the *income lost*, not the disruption itself. Every payout is a percentage of the worker's daily wage — nothing more.

---

## Persona — Who We're Building For

**Zepto and Blinkit delivery workers** face a unique income risk profile that no existing insurance product addresses:

- Operate on **10-minute delivery SLAs** — a 2-hour rain halt means 12+ missed deliveries and ₹300–600 in lost earnings
- **Dark-store tethered** — assigned to a single fulfilment zone, cannot shift to a safer area when disruption hits
- Earn approximately **₹350–600/day**, 6 days/week — no paid leave, no sick pay, no income buffer (Fairwork India Report, 2023–24)
- **Smartphone-native** — UPI, WhatsApp, and app-based workflows are their primary tools
- **Language-diverse** — most workers are more comfortable in Hindi, Kannada, Tamil, or Telugu than English

### Worker Profiles

| Worker | Earnings at Risk | Why KawaachAI Fits |
|---|---|---|
| Raju, Bengaluru | ₹450/day. Loses ₹350+ on heavy rain days — dark store zone prone to waterlogging. | ₹49/week premium. Up to ₹1,350 payout for 3 disrupted days. Net protection: 27× premium. |
| Priya, Mumbai | ₹520/day. Zone near Kurla — chronic monsoon waterlogging. Trigger fires 6–8× per monsoon. | High-risk zone premium ₹79/week. Annual payout potential covers what she'd otherwise lose in 3 weeks. |
| Kiran, Delhi | ₹480/day. AQI exceeds 300 regularly in winter months. | AQI trigger covers Nov–Feb exposure. Low flood risk → floor premium ₹49/week. |

### Persona Scenarios

**Scenario 1 — Raju, Bengaluru (Rain trigger)**
> OpenWeather reports 88mm rainfall in 24 hours in Raju's H3 zone. Threshold: >75mm. KawaachAI trigger monitor detects the breach. All active policyholders in the zone are identified. Fraud checks run in parallel. ClaimCenter FNOL submitted via Guidewire Cloud API. ₹225 (50% of ₹450 daily wage) credited to Raju's UPI. Zero action required from Raju.

**Scenario 2 — Priya, Mumbai (AQI trigger)**
> CPCB data shows AQI 342 in Priya's zone sustained for 3+ hours. Threshold: >300. All active policyholders in the zone are auto-claimed. Payout: 100% daily wage. No worker filed anything manually.

**Scenario 3 — Kiran, Delhi (Platform downtime trigger)**
> Blinkit app goes down for 2.5 hours. Platform downtime webhook fires. Kiran and all active policyholders in the zone receive 40% daily wage automatically.
> *(Civic curfew and platform downtime triggers use simulated webhooks in the demo — no public government or platform API exists for real-time detection. These represent the production integration target.)*

---

## How It Works — End-to-End Flow

```
External Disruption (Rain / AQI / Wind / Curfew / Platform Downtime)
        │
        ▼
Trigger Monitor — polls OpenWeather / CPCB / OpenWeather wind every 5 min per H3 zone
        │  Threshold breached
        ▼
Kafka event published → disruption-events topic
        │
        ▼
Claims Service ──► Fraud Engine (6 checks in parallel, target <50ms)
        │                    │
        │              [1. GPS zone check — PostGIS ST_DWithin]
        │              [2. Dedup lock — Redis SETNX]
        │              [3. Multi-source cross-validation]
        │              [4. Isolation Forest anomaly score]
        │              [5. Device fingerprint check]
        │              [6. SafeRider trust score]
        │
        ▼  (all checks pass)
Guidewire ClaimCenter — automated FNOL via Cloud API
        │  Claim: Draft → Approved
        ▼
Payout Service → Razorpay Payout API (sandbox / test mode)
        │
        ▼
Worker receives ₹ credit + FCM push notification

Target automated claim path: < 500ms (local demo environment)
```

---

## Onboarding Flow

A new worker can be fully onboarded and covered in under 3 minutes:

1. **Download app** — React Native, available in Hindi / Kannada / Tamil / Telugu, auto-detected from phone locale
2. **Identity verification** — Aadhaar number + OTP flow (simulated in demo; production uses DigiLocker Requester API, which requires government partnership approval)
3. **Link gig account** — Worker enters their Zepto or Blinkit Partner ID (self-declared; platform API validation simulated in demo)
4. **Zone assignment** — GPS location mapped to the nearest Uber H3 hexagon (Resolution 9, ~500m). AI risk profiler scores the zone.
5. **Premium shown** — Weekly premium displayed with SHAP feature breakdown. Worker signs UPI AutoPay mandate (deducted every Monday, aligned to Zepto/Blinkit payout day)
6. **Policy active** — Coverage begins immediately. First Disruption Forecast notification pushed via FCM.

---

## Weekly Premium Model

Gig workers earn and are paid weekly. Aligning premiums to their Monday Zepto/Blinkit payout eliminates the affordability barrier — the worker never pre-pays from savings. The ₹49–₹99/week range is calibrated to stay under 2% of weekly earnings for any eligible worker.

### Premium Formula

| Variable | Description | Range |
|---|---|---|
| Base premium | 4% of estimated daily wage × 7 days | ₹42–₹70 |
| Zone risk multiplier | XGBoost-scored H3 zone index (flood/AQI/wind history) | ×0.8 – ×1.4 |
| SafeRider discount | −6% per loyalty tier, max −24% at Tier 5 | −₹3 – −₹16 |
| Dost Shield discount | −10% for squad pool of 5–10 workers | −₹5 – −₹9 |
| **Final weekly premium** | max(₹49, base × zone_mult − discounts) | **₹49 – ₹99** |

*Zone multipliers are trained on publicly available historical weather data. Premium figures are illustrative and subject to actuarial review.*

### Example Calculation

| Worker | Zone Risk | Daily Wage | Base | Multiplier | Discount | Final |
|---|---|---|---|---|---|---|
| Raju, BLR | High flood | ₹450 | ₹63 | ×1.3 | −₹2 (new user) | **₹79/week** |
| Priya, MUM | High flood | ₹520 | ₹73 | ×1.3 | −₹8 (Tier 3) | **₹87/week** |
| Kiran, DEL | Medium AQI | ₹480 | ₹67 | ×1.0 | −₹18 (Tier 4) | **₹49/week** (floor) |

---

## 5 Parametric Triggers

All triggers fire automatically — no worker action required.

| # | Trigger | Data Source | Threshold | Payout |
|---|---|---|---|---|
| 1 | Heavy rain (moderate) | OpenWeather API (free tier) | >75mm / 24hr in H3 zone | 50% daily wage |
| 2 | Heavy rain (severe) | OpenWeather API (free tier) | >100mm / 24hr in H3 zone | 100% daily wage |
| 3 | Hazardous AQI | OpenWeather AQI / CPCB data | AQI >300 sustained >3 hrs | 100% daily wage |
| 4 | Cyclone / high wind | OpenWeather API (free tier) | Wind >60 kmph sustained | 100% daily wage |
| 5 | Civic curfew | Mock webhook (simulated) | Official curfew flag in zone | 75% daily wage |
| 6 | Platform downtime | Mock webhook (simulated) | App down >2 hrs | 40% daily wage |

**Max per week:** 3 disrupted days (3 × daily wage)

Triggers 1–4 use real free-tier APIs. Triggers 5–6 are simulated in the demo — they represent the production integration target once official data partnerships are in place.

**Cross-validation:** Triggers 1–4 require confirmation from ≥2 independent sources before a payout fires, reducing false positives from a single errant data feed.

---

## AI & ML Integration

### 1. XGBoost Dynamic Premium Engine
- **Input:** Feature vector per worker — H3 zone flood frequency, AQI index, wind exposure, claim history, SafeRider score, active delivery hours, monsoon season flag
- **Output:** Weekly premium + SHAP feature importance breakdown shown in-app
- **Why SHAP?** Every premium change is explained in plain language to the worker — no black-box pricing
- **Implementation:** Pre-trained on synthetic data; served via FastAPI pod inside Kubernetes

### 2. Isolation Forest Fraud Detection
- **Input:** Rolling feature vector per worker — claim frequency, GPS zone match rate, claim timing patterns, device consistency
- **Output:** Anomaly score. High-scoring claims are flagged for review, not auto-denied
- **Target inference latency:** <35ms
- **Implementation:** scikit-learn, served via FastAPI pod; feature vectors updated periodically via scheduled job (Apache Flink in production)

### 3. LSTM Disruption Forecast *(Phase 3)*
- **Input:** Historical weather and AQI data per H3 zone (from OpenWeather historical API and CPCB records)
- **Output:** 72-hour disruption probability per zone
- **Usage:** Powers the daily 6 AM push notification — *"High rain probability in your zone today. Consider upgrading coverage for ₹12 extra this week."*
- Phase 2 uses a rule-based probability estimate as a placeholder; full LSTM is a Phase 3 deliverable

### 4. LLM — Vernacular Onboarding and Borderline Claim Reasoning
- **Onboarding:** Claude or Gemini API handles natural-language queries during onboarding in the worker's chosen language. A worker can type *"bhai aaj policy kab milegi"* and receive a clear answer.
- **Borderline claims:** For claims that score near the fraud threshold, the LLM analyses the claim narrative and context to assist in review — reducing incorrect rejections

### 5. MLOps
- MLflow for experiment tracking and model registry (open source, runs locally)
- Model retraining is manual in Phase 2; automated drift-based retraining is a Phase 3 target

---

## Tech Stack

### Platform Choice: Mobile (React Native)

Workers are smartphone-native. UPI mandates, FCM push notifications, GPS, and eKYC flows are all mobile-native. A web app adds unnecessary friction. React Native provides a single codebase for iOS and Android.

### Build Stack

All backend services are containerised and deployed on Kubernetes. We use **minikube** locally — free, runs on a laptop, no cloud account required. The architecture is GKE-compatible for production. HPA scales the Claims service automatically under load; KEDA scales pods based on Kafka consumer lag, not CPU, so bursts during a mass disruption event are handled without manual intervention.

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | React Native (Expo) | iOS + Android, single codebase |
| Admin dashboard | React + Vite + Leaflet | H3 risk heatmap via Leaflet (free, open source) |
| Backend services | Node.js (TypeScript) | 5 services: Worker, Premium, Trigger, Claims, Payout |
| ML inference | Python + FastAPI | Serves XGBoost and Isolation Forest models |
| Trigger polling | Node.js cron job | Polls OpenWeather/CPCB every 5 min per H3 zone |
| Event streaming | Apache Kafka | disruption-events, claims-pipeline, payout-events topics |
| Container orchestration | Kubernetes — minikube | All services as pods with Helm charts |
| Config and secrets | Kubernetes ConfigMaps + Secrets | API keys never hardcoded |
| Pod autoscaling | HPA on Claims service | Scales under concurrent claim load |
| Event-driven autoscaling | KEDA — Kafka consumer lag → pod count | Scales with queue depth, not CPU |
| Observability | Prometheus + Grafana (kube-prometheus-stack Helm) | Pod count, claim throughput, Kafka lag |
| CI/CD | GitHub Actions → kubectl apply | Push to main triggers redeploy |
| Transactional DB | PostgreSQL + PostGIS | Workers, policies, claims — geospatial fraud checks |
| Cache / dedup | Redis | SETNX deduplication locks per worker per event |
| Spatial indexing | Uber H3 (h3-js npm package) | Resolution 9, ~500m hexagons |
| Payments | Razorpay Payout API (sandbox / test mode) | No real money — demo only |
| Push notifications | FCM (Firebase free tier) | In-app and lock-screen notifications |
| ML tracking | MLflow | Experiment tracking and model registry |
| Weather / AQI | OpenWeather API (free tier), CPCB data | Rainfall, AQI, wind — real data for triggers 1–4 |

### Guidewire Integration

Guidewire ClaimCenter and PolicyCenter are enterprise software, not open source. Access is provided to DEVTrails 2026 participants as part of competition resources. The integration is built against the documented Guidewire Cloud API contract; a mock layer is in place until environment credentials are confirmed.

| Component | How We Use It |
|---|---|
| **Advanced Product Designer (APD)** | Define the income insurance product, coverages, and explicit exclusions (no health, no vehicle) |
| **PolicyCenter Cloud API** | Weekly policy creation, renewal, and cancellation |
| **ClaimCenter Cloud API** | Automated FNOL: `POST /claims` with trigger data, H3 zone ID, payout amount |
| **Application Events** | `claim.approved` event triggers downstream UPI payout |

---

## Spatial Intelligence — Uber H3

We use **Uber H3 at Resolution 9** (~500m hexagon) for all zone-based operations.

- Indian postal codes span 5–15km — too coarse for localised weather events
- H3 resolution 9 gives ~500m precision — sufficient to distinguish zone-level disruption accurately
- Hexagons tile with no gaps or overlaps — unambiguous zone membership for any GPS coordinate
- Every fraud check, trigger evaluation, and premium calculation is zone-pinned at H3 level

---

## 6-Layer Fraud Defense Stack

All 6 checks run in parallel. Combined target latency: <50ms.

| Layer | Technology | What It Catches |
|---|---|---|
| 1. Geospatial | PostGIS ST_DWithin | Worker GPS outside the triggered H3 zone |
| 2. Deduplication | Redis SETNX (7-day TTL key per worker per week) | Same worker claiming the same event twice |
| 3. Source verification | ≥2 of 3 API sources must agree | Single rogue data feed falsely triggering a payout |
| 4. Behavioural ML | Isolation Forest anomaly score | Unusual claim frequency, timing, or pattern |
| 5. Identity | Device fingerprint vs registered VPA | Unrecognised device requesting a payout |
| 6. Trust signal | SafeRider Score (Tiers 1–5) | Adjusts friction level — high-trust workers fast-tracked |

GPS zone validation eliminates claims from workers who are not in the affected area — the most common form of parametric insurance fraud. The remaining layers catch coordinated or behavioural fraud patterns. Claims flagged by the ML layer are held for manual review, not auto-denied.

---

## Novelty Features

### 1. Disruption Forecast — Daily Earnings Weather Report
Every morning, each insured worker receives a push notification with the disruption probability for their zone: *"High rain risk in your zone today. Consider upgrading your coverage for ₹12 extra this week."* This is proactive risk communication — it transforms the app from a passive safety net into a daily planning tool. No gig worker insurance product in India currently offers this. *(Phase 3 — LSTM model; Phase 2 uses rule-based estimate)*

### 2. SafeRider Score — Loyalty Lowers Your Premium
A 5-tier trust and loyalty system built into the core pricing model. Workers earn score by maintaining continuous weekly coverage and filing no fraudulent claims.

| Tier | Label | Premium Discount | Fraud Check |
|---|---|---|---|
| 1 | New | 0% | Standard |
| 2 | Growing | −6% | Standard |
| 3 | Regular | −12% | Reduced |
| 4 | Trusted | −18% | Minimal |
| 5 | Champion | −24% (floor ₹49) | Fast-track |

### 3. Dost Shield — Squad Pooling
Groups of 5–10 workers from the same dark store voluntarily pool together. If no one in the group files a claim in a given week, every member receives 10% premium cashback the following Monday — timed to their Zepto/Blinkit payout. Creates social accountability against fraud and builds community among isolated workers.

### 4. Impact Widget — "What Insurance Did For You"
A persistent home screen widget: *"This month, disruptions would have cost you ₹2,100. You paid ₹196 in premiums."* Updated after every payout event. Makes the value of insurance tangible and concrete for daily-wage workers — the most effective retention mechanism in the product.

### 5. Vernacular UI + LLM Chatbot
App supports Hindi, Kannada, Tamil, and Telugu, auto-detected from phone locale. All push notifications and payout receipts are sent in the worker's chosen language. An LLM chatbot handles onboarding queries naturally — a worker can type *"bhai aaj policy kab milegi"* and receive a clear, useful response.

### 6. Risk Heatmap — Insurer Dashboard
A live map (Leaflet + H3 hexagon layer) covering Bengaluru, Mumbai, and Delhi, colour-coded from green (low risk) to red (high disruption). Each hexagon shows active policy count, current-week claim rate, and zone loss ratio. Insurers can drill into any hexagon for weather history, claim history, and fraud flag counts. Updated every 5 minutes from the trigger polling service.

---

## Business Viability

### Unit Economics (Illustrative — Bengaluru worker)

| Metric | Conservative | Optimistic |
|---|---|---|
| Weekly premium | ₹49 | ₹79 |
| Annual premium revenue per worker | ₹2,548 | ₹4,108 |
| Estimated disruption days/year (Bengaluru) | 18 | 28 |
| Estimated annual payout per worker | ₹8,100 | ₹13,440 |
| Raw theoretical loss ratio | ~318% | ~327% |
| Estimated post-fraud-stack loss ratio | ~95% | ~98% |
| Platform fee (10% of premium) | ₹255/yr | ₹411/yr |

*Illustrative estimates based on publicly available Bengaluru rainfall frequency data and standard insurance industry benchmarks. Actual figures require actuarial modelling.*

**Key insight:** Parametric income insurance for gig workers is only commercially viable with effective fraud prevention. The 6-layer fraud stack is the financial backbone of the business model — GPS zone validation alone eliminates claims from workers outside the affected area, the most common form of fraud in location-based parametric products.

### Regulatory Path
- **IRDAI Micro-Insurance Guidelines 2023:** Premiums under ₹100/week qualify as micro-insurance — KawaachAI's entire range qualifies
- **IRDAI Regulatory Sandbox (2019):** Enables a 2-year pilot without a full insurance license, lowering the barrier to launch
- **Code on Social Security (2020, operational 2025):** Establishes social security obligations for platform-based gig workers — compliance is ongoing across platforms, creating demand for supplementary income protection

### Market Size
- India's gig workforce: 7.7M today → projected 23.5M by 2030 (NITI Aayog, 2022)
- Q-commerce is among the fastest-growing gig segments, with Zepto and Blinkit together operating across 20+ Indian cities

---

## References

| Topic | Source |
|---|---|
| Gig worker data | NITI Aayog: *India's Booming Gig and Platform Economy* (2022) |
| Worker conditions and earnings | Fairwork India Report 2023–2024 |
| Parametric insurance | Geneva Association: *Parametric Insurance: A Primer* |
| Parametric vs indemnity | Investopedia: *Parametric vs Indemnity Insurance* |
| IRDAI regulation | IRDAI Sandbox Regulations 2019; IRDAI Micro-Insurance Guidelines 2023 |
| AI in insurance | McKinsey: *Insurance 2030 — The Impact of AI* |
| Fraud detection | scikit-learn Isolation Forest documentation |
| Weather and AQI data | OpenWeather API (openweathermap.org); CPCB (cpcb.nic.in) |
| Spatial indexing | Uber H3 — h3geo.org |
| Guidewire APIs | developer.guidewire.com — ClaimCenter and PolicyCenter Cloud API documentation |

---

*KawaachAI — Parametric income protection for India's Q-commerce delivery workers.*
