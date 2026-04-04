# KawaachAI — Parametric Income Insurance for Q-Commerce Delivery Workers

> **Guidewire DEVTrails 2026** · Persona: Q-Commerce (Zepto & Blinkit) · Phase 1 — March 20, 2026

---
**Try the live demo:** [KawaachAI Tryout](https://kawaach-ai-tryout.vercel.app/)

## SPEC-05 One-Command Startup

From repository root, start the full stack (core services + SPEC-05 admin API + admin dashboard):

```bash
docker compose up -d --build
```

Default URLs:

- Trigger Monitor: `http://localhost:3001`
- Claims Service: `http://localhost:3002`
- SPEC-05 Admin API: `http://localhost:3010`
- SPEC-05 Admin Dashboard: `http://localhost:5178`

Notes:

- `db-init` runs migrations + seed automatically before app services start.
- SPEC-05 seeded demo claims are inserted automatically by `spec5-admin-api` when `SPEC5_RUN_SEED=true`.

## Phase 2 Backend Quick Start (SPEC-01)

The monorepo implementation for SPEC-01 is now scaffolded with three packages:

- `packages/shared`
- `packages/trigger-monitor`
- `packages/claims-service`

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop running

### Run Locally

1. Install dependencies.

```bash
npm install
```

2. Copy environment template and fill API credentials.

```bash
cp .env.example .env
```

3. Start core infrastructure.

```bash
docker compose up -d postgres redis kafka
```

4. Apply schema and seed demo data.

```bash
npm run setup:db
```

5. Start services in separate terminals.

```bash
npm run dev:trigger
npm run dev:claims
```

6. Run smoke checks.

```bash
ADMIN_BEARER_TOKEN=change-me npm run smoke
ADMIN_BEARER_TOKEN=change-me npm run smoke:spec02
```

7. (Optional) retrain SPEC-02 fraud model artifacts.

```bash
python3 -m pip install -r scripts/requirements-fraud-model.txt
npm run retrain-fraud-model
```

### Implemented Endpoints (SPEC-01 scope)

- Trigger Monitor
        - `GET /health`
        - `GET /admin/exclusions`
        - `PATCH /admin/exclusions`
        - `POST /webhooks/curfew`
        - `POST /webhooks/platform-downtime`
- Claims Service
        - `GET /health`
        - `GET /claims/:claimId`
        - `GET /claims?workerId=`

## The Problem

Ravi delivers groceries for Zepto in Bengaluru. Last monsoon, several days of heavy rain halted all deliveries in his zone. He lost his week's wages — no refund, no compensation, no safety net. He had no insurance. Neither did any of his fellow Q-commerce delivery workers.

Platform-based gig workers can lose **20–30% of monthly earnings** during periods of sustained external disruption — extreme rain, toxic AQI, cyclones, and civic curfews — based on estimates from gig worker income vulnerability research. India's gig workforce stands at 7.7 million today and is projected to reach 23.5 million by 2030 (NITI Aayog, 2022). The majority carry no income protection against these events.

**KawaachAI** is a parametric income insurance platform for Zepto and Blinkit delivery workers. The design principle: don't build a claim-after-loss tool — build a protect-before-loss platform. When an external disruption crosses a verified threshold, the system auto-detects the event, raises a claim in Guidewire ClaimCenter, and credits lost wages to the worker's UPI ID with zero manual action required.

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

- Operate on **10-minute delivery SLAs** — even a 2-hour rain halt means multiple missed deliveries and ₹300–600 in lost earnings
- **Dark-store tethered** — assigned to a single fulfilment zone, cannot shift to a safer area when disruption hits
- Earn approximately **₹350–600/day**, 6 days/week — no paid leave, no sick pay, no income buffer (Fairwork India Report, 2023–24)
- **Smartphone-native** — UPI, WhatsApp, and app-based workflows are their primary tools
- **Language-diverse** — most workers are more comfortable in Hindi, Kannada, Tamil, or Telugu than English

### Worker Profiles

Q-commerce delivery workers earn ₹350–600/day working 6 days/week (Fairwork India Report, 2023–24). Three illustrative profiles within this range:

| Worker | Risk Exposure | How KawaachAI Responds |
|---|---|---|
| Raju, Bengaluru | Dark store zone prone to monsoon waterlogging. Rain disruptions cost him multiple days of income each monsoon season. | Rainfall trigger fires automatically. Payout covers 50–100% of daily wage per disrupted day, up to 3 days/week. |
| Priya, Mumbai | Zone near Kurla — a well-documented repeat flooding area. Disruptions halt deliveries entirely when waterlogging hits. | High-risk zone reflected in premium. Coverage activates without any action from Priya. |
| Kiran, Delhi | AQI exceeds 300 regularly during November–February — a seasonal pattern in CPCB annual data. Outdoor delivery in hazardous air is income-threatening. | AQI trigger covers the winter exposure window. Lower flood risk keeps her premium at the floor. |

### Persona Scenarios

**Scenario 1 — Raju, Bengaluru (Rain trigger)**
> OpenWeather reports rainfall exceeding 75mm in 24 hours in Raju's H3 zone. KawaachAI's trigger monitor detects the breach. All active policyholders in the zone are identified. Fraud checks run in parallel. ClaimCenter FNOL submitted via Guidewire Cloud API. 50% of Raju's daily wage credited to his UPI. Zero action required from Raju.

**Scenario 2 — Priya, Mumbai (AQI trigger)**
> CPCB data shows AQI exceeding 300 in Priya's zone for 3+ consecutive hours. All active policyholders in the zone are auto-claimed. Payout: 100% daily wage. No worker filed anything manually.

**Scenario 3 — Kiran, Delhi (Platform downtime trigger)**
> Blinkit app is unavailable for over 2 hours. Platform downtime webhook fires. Kiran and all active policyholders in the zone receive 40% daily wage automatically.
> *(Civic curfew and platform downtime triggers use simulated webhooks in the demo — no public government or platform API exists for real-time detection. These represent the production integration target.)*

---

## How It Works — End-to-End Flow

```
External Disruption (Rain / AQI / Wind / Curfew / Platform Downtime)
        │
        ▼
Trigger Monitor — polls OpenWeather (rainfall + wind) and CPCB (AQI) every 5 min per H3 zone
        │  Threshold breached
        ▼
Kafka event published → disruption-events topic
        │
        ▼
Claims Service ──► Fraud Engine (checks run in parallel, target <50ms)
        │                    │
        │              [1. OS mock location check]
        │              [2. GPS zone check — PostGIS ST_DWithin]
        │              [3. Dedup lock — Redis SETNX]
        │              [4. Multi-source cross-validation]
        │              [5. Sensor physics + Isolation Forest score]
        │              [6. SafeRider trust score]
        │
        ▼  (all checks pass)
Guidewire ClaimCenter — automated FNOL via Cloud API
        │  Claim: Draft → Open
        ▼
Payout Service → Razorpay Payout API (sandbox / test mode)
        │
        ▼
Worker receives ₹ credit + FCM push notification

Target automated claim path: <500ms on local demo environment
```

---

## Onboarding Flow

A new worker can be onboarded and covered in a single session:

1. **Download app** — React Native, available in Hindi / Kannada / Tamil / Telugu, auto-detected from phone locale
2. **Identity verification** — Aadhaar number + OTP flow (simulated in demo; production uses DigiLocker Requester API, which requires government partnership approval)
3. **Link gig account** — Worker enters their Zepto or Blinkit Partner ID (self-declared; platform API validation is simulated in demo)
4. **Zone assignment** — GPS location mapped to the nearest Uber H3 hexagon (Resolution 9, ~500m). AI risk profiler scores the zone.
5. **Premium shown** — Weekly premium displayed with SHAP feature breakdown. Worker signs UPI AutoPay mandate (deducted every Monday, aligned to Zepto/Blinkit payout day)
6. **Policy confirmed** — Coverage begins immediately. Confirmation sent via FCM push notification.

---

## Weekly Premium Model

Gig workers earn and are paid weekly. Aligning premiums to their Monday Zepto/Blinkit payout eliminates the affordability barrier — the worker never pre-pays from savings. The floor premium of ₹49 represents under 2.5% of weekly earnings for a worker earning ₹350/day — the lower bound of the reported earnings range.

### Premium Formula

| Variable | Description | Range |
|---|---|---|
| Base premium | 2% of estimated weekly earnings (daily wage × 7) | ₹42–₹70 |
| Zone risk multiplier | XGBoost-scored H3 zone index (flood/AQI/wind history) | ×0.8–×1.4 |
| SafeRider discount | −6% per loyalty tier, max −24% at Tier 5 | −₹3–−₹16 |
| Dost Shield discount | −10% for squad pool of 5–10 workers | −₹4–−₹9 |
| **Final weekly premium** | max(₹49, min(₹99, zone_adjusted − discounts)) | **₹49–₹99** |

*Zone multipliers are trained on publicly available historical weather data. All figures are illustrative and subject to actuarial review before any commercial deployment.*

### Example Calculation

| Worker | Zone Risk | Daily Wage | Base (2% of weekly) | Multiplier | Discount | Final |
|---|---|---|---|---|---|---|
| Raju, BLR | High flood | ₹450 | ₹63 | ×1.3 → ₹82 | −₹2 (Tier 1, new user) | **₹80/week** |
| Kiran, DEL | Medium AQI | ₹480 | ₹67 | ×0.9 → ₹60 | −₹11 (Tier 4, −18% of ₹60) | **₹49/week** (floor) |

---

## 5 Parametric Triggers

All triggers fire automatically — no worker action required.

| # | Trigger | Data Source | Threshold | Payout |
|---|---|---|---|---|
| 1 | Heavy rain (moderate) | OpenWeather API (free tier) | >75mm / 24hr in H3 zone | 50% daily wage |
| 2 | Heavy rain (severe) | OpenWeather API (free tier) | >100mm / 24hr in H3 zone | 100% daily wage |
| 3 | Hazardous AQI | OpenWeather AQI + CPCB data | AQI >300 sustained >3 hrs | 100% daily wage |
| 4 | Cyclone / high wind | OpenWeather API (free tier) | Wind >60 kmph sustained | 100% daily wage |
| 5 | Civic curfew | Mock webhook (simulated) | Official curfew flag in zone | 75% daily wage |
| 6 | Platform downtime | Mock webhook (simulated) | App down >2 hrs | 40% daily wage |

**Max per week:** 3 disrupted days (3 × daily wage)

Triggers 1–4 use real free-tier APIs. Triggers 5–6 are simulated in the demo and represent the production integration target.

**Cross-validation:** Triggers 1–4 require confirmation from ≥2 independent sources before a payout fires, reducing false positives from a single errant data feed.

---

## AI & ML Integration

### 1. XGBoost Dynamic Premium Engine
- **Input:** Feature vector per worker — H3 zone flood frequency, AQI index, wind exposure, claim history, SafeRider score, active delivery hours, monsoon season flag
- **Output:** Weekly premium + SHAP feature importance breakdown shown in-app
- **Why SHAP?** Every premium change is explained in plain language — no black-box pricing
- **Implementation:** Pre-trained on synthetic data; served via FastAPI pod inside Kubernetes

### 2. Isolation Forest Fraud Detection
- **Input:** Rolling feature vector per worker — claim frequency, GPS zone match rate, claim timing patterns, device consistency
- **Output:** Anomaly score 0–1. High-scoring claims are flagged for review, not auto-denied
- **Target inference latency:** <35ms
- **Implementation:** scikit-learn Isolation Forest, served via FastAPI pod

### 3. LSTM Disruption Forecast *(Phase 3)*
- **Input:** Historical weather and AQI data per H3 zone from OpenWeather historical API and CPCB records
- **Output:** 72-hour disruption probability per zone
- **Usage:** Powers a daily morning push notification — *"High rain probability in your zone today. Consider upgrading your coverage this week."*
- Phase 2 uses a rule-based probability estimate; full LSTM model is a Phase 3 deliverable

### 4. LLM — Vernacular Onboarding and Borderline Claim Reasoning
- **Onboarding:** Claude or Gemini API handles natural-language queries during onboarding in the worker's chosen language. A worker can type *"bhai aaj policy kab milegi"* and receive a clear answer.
- **Borderline claims:** For claims that score near the fraud threshold, the LLM analyses available claim context to assist the manual review process — reducing incorrect rejections

### 5. MLOps
- MLflow for experiment tracking and model registry (open source, runs locally)
- Model retraining is manual in Phase 2; automated drift-based retraining is a Phase 3 target

---

## Tech Stack

### Platform Choice: Mobile (React Native)

Workers are smartphone-native. UPI mandates, FCM push notifications, GPS, and eKYC flows are all mobile-native. A web app adds unnecessary friction. React Native provides a single codebase for iOS and Android.

### Build Stack

All backend services are containerised and deployed on Kubernetes. We use **minikube** locally — free, runs on a laptop, no cloud account required. The architecture is GKE-compatible for production. HPA scales the Claims service automatically under load; KEDA scales pods based on Kafka consumer lag so bursts during a mass disruption event are handled without manual intervention.

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | React Native (Expo) | iOS + Android, single codebase |
| Admin dashboard | React + Vite + Leaflet | H3 risk heatmap via Leaflet (free, open source) |
| Backend services | Node.js (TypeScript) | 5 services: Worker, Premium, Trigger, Claims, Payout |
| ML inference | Python + FastAPI | Serves XGBoost and Isolation Forest models |
| Trigger polling | Node.js cron job | Polls OpenWeather and CPCB every 5 min per H3 zone |
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
| **ClaimCenter Cloud API** | Two-step FNOL: `POST /claims/v1/claim` creates the claim in Draft state — policy data pulled automatically from PolicyCenter; `POST /claims/v1/{claimId}/submit` transitions to Open state, entering adjudication with no manual data entry |
| **Application Events** | ClaimCenter broadcasts the approved state asynchronously → Payout Service consumes and initiates Razorpay UPI settlement |

---

## Spatial Intelligence — Uber H3

We use **Uber H3 at Resolution 9** (~500m hexagon) for all zone-based operations.

- Indian postal codes span 5–15km — too coarse for localised weather events
- H3 resolution 9 gives ~500m precision — sufficient to distinguish zone-level disruption accurately
- Hexagons tile with no gaps or overlaps — unambiguous zone membership for any GPS coordinate
- Every fraud check, trigger evaluation, and premium calculation is zone-pinned at H3 level

---

## 6-Layer Fraud Defense Stack

All checks run in parallel. Combined target latency: <50ms.

| Layer | Technology | What It Catches |
|---|---|---|
| 1. OS mock location | Android `isFromMockProvider()` API | GPS coordinates injected by a spoofing app in developer mode |
| 2. Geospatial | PostGIS ST_DWithin | Worker GPS outside the triggered H3 zone |
| 3. Deduplication | Redis SETNX (7-day TTL key per worker per event) | Same worker claiming the same event twice |
| 4. Source verification | ≥2 of 3 API sources must agree | Single rogue data feed falsely triggering a payout |
| 5. Behavioural ML | Isolation Forest anomaly score | Unusual claim frequency, timing, or pattern |
| 6. Trust signal | SafeRider Score (Tiers 1–5) | Adjusts friction — high-trust workers fast-tracked |

GPS zone validation eliminates claims from workers outside the affected area. The OS mock check catches developer-mode spoofing before any ML runs. The remaining layers address coordinated and behavioural fraud. Claims flagged by the ML layer are held for manual review, not auto-denied.

---

## Adversarial Defense & Anti-Spoofing Strategy

### The Threat

A coordinated syndicate of delivery workers can organise via messaging apps, use readily available GPS-spoofing applications to fake their location inside a disrupted H3 zone, and trigger mass false payouts while sitting safely at home. Basic GPS coordinate checks are insufficient — spoofing apps reproduce valid-looking coordinates with no effort.

### The Core Insight

**GPS spoofing apps can fake a coordinate. They cannot fake physics.**

A delivery worker genuinely caught in a flooded zone produces a completely different device sensor fingerprint from one sitting still at home running a spoofing app. This is the fundamental asymmetry the defense is built on.

---

### Layer 1 — OS Mock Location Detection (First Gate)

Before any sensor analysis, the app queries the Android OS directly. This catches all consumer GPS spoofing apps, which work by enabling developer mode and injecting fake coordinates:

- **`Settings.Secure.ALLOW_MOCK_LOCATION`** — queried at claim time. If mock locations are enabled in developer settings, the claim is immediately flagged.
- **`isFromMockProvider()`** — every incoming location fix is interrogated using this boolean. A `true` response means the coordinate was injected by a third-party app rather than a real satellite fix. Claim is invalidated.

This single check eliminates the majority of casual spoofing attempts with negligible latency, before any ML processing occurs.

---

### Layer 2 — Sensor Physics Fingerprint

For claims that pass the mock location gate, the app cross-validates the claimed location against passive device signals that spoofing apps cannot intercept:

| Signal | What a genuine worker shows | What a spoofer shows |
|---|---|---|
| **Accelerometer pattern** | Irregular micro-vibrations consistent with a two-wheeler on a wet road | Near-zero variance — phone sitting flat at home |
| **Barometric pressure delta** | Pressure consistent with the outdoor weather event in the zone | Pressure consistent with an indoor environment |
| **GNSS signal quality — AGC / C/N0** | Natural signal variability as satellite geometry shifts | A C/N0 spike paired with AGC drop — the deterministic hardware signature of a localised GNSS spoofing signal (on devices with `GnssStatus` API support, Android API level 24+) |
| **GNSS timestamp vs NTP delta** | Satellite timestamp matches network time within tolerance | Divergence between GNSS message timestamp and NTP server time indicates temporal manipulation |
| **WiFi BSSID triangulation** | Visible WiFi router MAC addresses (BSSIDs) geo-resolve to the claimed H3 zone | BSSIDs resolve to the worker's home neighbourhood, not the claimed zone |
| **Cell tower ID** | Tower maps to the declared H3 zone (via OpenCelliD open database) | Tower maps to the worker's home area |
| **Battery drain rate** | Elevated — active GPS and mobile data in poor signal conditions | Normal idle drain |

These signals are read passively at claim time. No worker action is required. Defeating all of them simultaneously requires hardware-level manipulation that is not practical for gig-economy fraud rings.

---

### Layer 3 — Mobility Proof Trail

The KawaachAI app maintains a passive 30-minute location history before any claim is triggered:

- **Speed variance:** A genuine worker navigating a disrupted zone shows irregular movement — stopping, rerouting, waiting. A spoofer shows zero real movement regardless of the fake GPS path.
- **Route continuity and vector analysis:** The trail is compared against the road network using OpenStreetMap data. GPS emulation tools characteristically produce perfectly straight-line paths with no natural acceleration variance — the hallmark of software simulation. Spoofed paths also frequently pass through buildings or take geometrically impossible routes.
- **Recent app activity in zone:** If the worker's app recorded active GPS pings within the claimed H3 zone in the 90 minutes before the claim, this is treated as a genuine-presence signal.

---

### Layer 4 — Syndicate Graph Detection

Individual fraud is addressed by Layers 1–3. Coordinated ring fraud requires a graph-level view.

A syndicate organising together will file claims within a narrow time window. Critically, their devices will carry a proximity and network signature from the coordination event — even after they disperse.

KawaachAI evaluates the claim batch as a graph:

- **Claim burst detection:** Genuine disruptions produce a gradual claim curve as workers individually encounter the event. Coordinated rings produce a statistically anomalous spike. A configurable burst threshold triggers elevated scrutiny on the entire batch.
- **Device proximity history:** The KawaachAI app passively logs nearby WiFi BSSID hashes while active. Workers who were physically co-located during coordination share a common set of BSSID signatures in the hours before the event — this trace persists after they disperse.
- **Shared network flag:** Claims from devices that shared a NAT IP or mobile carrier subnet in the preceding 24 hours are tagged. Independent workers operating across a city do not share network infrastructure.

The graph query runs on the incoming claim batch. High internal connectivity — workers graph-adjacent via proximity or network — elevates the batch-level fraud signal, not just individual scores.

---

### Layer 5 — Composite Isolation Forest Scorer

All signals from Layers 1–4 are combined into a feature vector and scored by the Isolation Forest model. In the demo this runs as a Node.js service; Apache Flink is the production stream processor for joining location, device state, and API polling events at scale.

```
fraud_score = IsolationForest([
  mock_location_flag,            # isFromMockProvider() or ALLOW_MOCK_LOCATION
  accelerometer_variance,
  barometric_delta_match,        # pressure consistent with weather event?
  gnss_cn0_agc_anomaly,          # C/N0 spike + AGC drop (supported devices only)
  gnss_ntp_time_delta,           # satellite timestamp vs NTP divergence
  bssid_zone_match,              # BSSIDs geo-resolve to claimed H3 zone
  cell_tower_zone_match,
  battery_drain_z_score,
  speed_variance_30min,
  route_vector_linearity,        # unnaturally straight paths indicate emulation
  recent_app_activity_in_zone,   # boolean
  claim_burst_rank,              # position in the simultaneous claim curve
  device_proximity_graph_degree,
  shared_network_flag            # boolean
])
```

Target inference: <35ms. Model pre-trained on synthetic fraud patterns; retrained as labelled data accumulates.

---

### Outcome Tiers — Dynamic Risk-Based Authentication (RBA)

The critical design constraint: **an honest worker experiencing a genuine network drop in bad weather must not be penalised.**

Heavy rain degrades GPS accuracy, drops mobile data, and elevates battery drain. The system is calibrated so that these conditions — genuine signals of outdoor disruption — do not raise the fraud score. This graduated response is Dynamic Risk-Based Authentication: proportionate friction based on anomaly level, not binary approve/reject logic.

| Score | Outcome | Worker Experience |
|---|---|---|
| < 0.4 | Auto-approved | Payout fires immediately. No friction. |
| 0.4–0.72 | Soft hold — 2 hours | Worker receives: *"Your claim has been received. Due to severe weather and network congestion in your zone, processing requires a short additional time."* No action required. Sensors re-checked passively. If score drops below 0.4, payout fires automatically. Messaging validates the worker's environment without exposing the investigation. |
| > 0.72 | Step-up verification | Worker is prompted to briefly enable WiFi for a BSSID re-check, or allow a passive accelerometer re-read. One low-friction step. If confirmed, payout fires. If no response within 4 hours, claim routes to manual review. |

**SafeRider trust override:** Workers at Tier 4 or Tier 5 skip the soft hold entirely. Their flagging threshold is raised from 0.72 to 0.85. Earned loyalty has a direct operational consequence — not just a premium discount.

**Manual review — LLM-assisted investigation:** Claims that cannot be resolved automatically route to the admin dashboard. An LLM agent aggregates the claim's sensor logs, location history, device state timeline, and fraud score breakdown into a concise summary for the human reviewer — enabling fast, accurate decisions on complex edge cases without requiring investigators to parse raw telemetry.

**Why this is different:** Most fraud systems ask "Is this GPS coordinate inside the zone?" — a question any spoofing app answers trivially. KawaachAI asks whether the complete physical, behavioural, and network fingerprint of the device matches what a genuinely disrupted worker produces, and whether the claim batch as a whole carries the statistical signature of a natural event or a coordinated ring. These questions require physical presence to answer correctly.

---

## Novelty Features

### 1. Disruption Forecast — Daily Earnings Weather Report
Every morning, each insured worker receives a push notification with the disruption probability for their zone: *"High rain risk in your zone today. Consider upgrading your coverage this week."* This transforms the app from a passive safety net into a daily planning tool. No gig worker insurance product in India currently offers this. *(Phase 3 — LSTM model; Phase 2 uses a rule-based estimate)*

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
Groups of 5–10 workers from the same dark store voluntarily pool together. If no one in the group files a claim in a given week, every member receives 10% premium cashback the following Monday — timed to their Zepto/Blinkit payout. Creates social accountability against fraud and builds community among workers.

### 4. Impact Widget — What Insurance Did For You
A persistent home screen widget showing the worker's cumulative protected earnings against premiums paid to date, updated after every payout event. Makes the value of insurance tangible for daily-wage workers.

### 5. Vernacular UI + LLM Chatbot
App supports Hindi, Kannada, Tamil, and Telugu, auto-detected from phone locale. All push notifications and payout receipts are sent in the worker's chosen language. An LLM chatbot handles onboarding queries naturally — a worker can type *"bhai aaj policy kab milegi"* and receive a clear, useful response.

### 6. Risk Heatmap — Insurer Dashboard
A live map (Leaflet + H3 hexagon layer) of insured cities, colour-coded from green (low risk) to red (high disruption). Each hexagon shows active policy count, current-week claim rate, and zone loss ratio. Insurers can drill into any hexagon for weather history, claim history, and fraud flag counts. Updated every 5 minutes from the trigger polling service.

---

## Business Viability

### Unit Economics (Illustrative — Bengaluru worker)

| Metric | Conservative | Optimistic |
|---|---|---|
| Weekly premium | ₹49 | ₹79 |
| Annual premium revenue per worker | ₹2,548 | ₹4,108 |
| Estimated disruption days/year | 18 | 28 |
| Estimated annual payout per worker | ₹8,100 | ₹13,440 |
| Raw theoretical loss ratio | ~318% | ~327% |
| Estimated post-fraud-stack loss ratio | ~95% | ~98% |
| Platform fee (10% of premium) | ₹255/yr | ₹411/yr |

*All figures are illustrative estimates based on publicly available Bengaluru rainfall data and standard insurance industry benchmarks. Actual figures require actuarial modelling and are not a commercial commitment.*

**Key insight:** Parametric income insurance is only commercially viable with effective fraud prevention. The fraud stack is the financial backbone of the business model — GPS zone validation eliminates claims from workers outside the affected area, and the syndicate graph layer addresses coordinated ring fraud that individual-level checks cannot catch.

### Regulatory Path
- **IRDAI Micro-Insurance Guidelines 2023:** Premiums under ₹100/week qualify as micro-insurance — KawaachAI's entire premium range qualifies
- **IRDAI Regulatory Sandbox (2019):** Enables a 2-year pilot without a full insurance license
- **Code on Social Security (2020, operational 2025):** Establishes social security obligations for platform-based gig workers — compliance is ongoing, creating demand for supplementary income protection

### Market Size
- India's gig workforce: 7.7M today → projected 23.5M by 2030 (NITI Aayog, 2022)
- Zepto and Blinkit together operate across major Indian cities, with Q-commerce among the fastest-growing gig segments

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
| Fraud detection — ML | scikit-learn Isolation Forest documentation |
| GPS spoofing detection | Android Developers: `GnssStatus` API; Bureau.id: *How to Detect Location Spoofing* |
| GNSS jamming / spoofing | NAVIGATION journal: *Detecting GNSS Jamming and Spoofing on Android Devices* (2022) |
| Cell tower geolocation | OpenCelliD open database — opencellid.org |
| Road network data | OpenStreetMap — openstreetmap.org |
| Weather and AQI | OpenWeather API (openweathermap.org); CPCB (cpcb.nic.in) |
| Spatial indexing | Uber H3 — h3geo.org |
| Guidewire FNOL API | Guidewire documentation: *The FNOL process in Cloud API* — developer.guidewire.com |

---

*KawaachAI — Parametric income protection for India's Q-commerce delivery workers.*
