# SPEC-05 Isolated Implementation

This folder contains an isolated Phase 2 SPEC-05 implementation and does not modify existing services in `packages/claims-service`, `packages/trigger-monitor`, or `packages/shared`.

## Modules

- `admin-api`: SPEC-05 backend endpoints, LLM review orchestration, metrics, structured logging
- `admin-dashboard`: React dashboard for KPIs, heatmap, fraud monitor, manual review, exclusions

## Features Implemented

- Real-time KPI dashboard with 30s polling
- Claims timeline (`GET /admin/claims?limit=50`)
- H3 risk heatmap with drill-down and layer toggles (5 minute refresh)
- Fraud monitor with 6-layer performance table and ring graph
- LLM manual review endpoint and structured response card
- Admin decision override flow (`PATCH /admin/claims/:id/decision`)
- Exclusion management panel with confirmation guard
- Service health panel from `/health` probes
- Prometheus metrics at `/metrics`
- Structured JSON logging with `request_id`, `event`, `duration_ms`

## Run Full Platform with One Docker Compose Command

From repository root:

```bash
docker compose up -d --build
```

This starts all services, including SPEC-05:

- trigger-monitor
- claims-service
- spec5-admin-api
- spec5-admin-dashboard

Default URLs:

- Trigger Monitor: `http://localhost:3001`
- Claims Service: `http://localhost:3002`
- SPEC-05 Admin API: `http://localhost:3010`
- SPEC-05 Admin Dashboard: `http://localhost:5178`

### Seed Behavior in Docker

`spec5-admin-api` seeds SPEC-05 demo claims automatically on container start when:

- `SPEC5_RUN_SEED=true` (default)

Set `SPEC5_RUN_SEED=false` in `.env` if you want to disable auto-seeding.

## Local Development Fallback (without full compose)

If you want faster iteration on SPEC-05 only, keep infra and core services in Docker and run SPEC-05 apps locally:

```bash
docker compose up -d postgres redis kafka trigger-monitor claims-service

cd packages/spec5/admin-api
npm install
npm run seed
npm run dev

cd ../admin-dashboard
npm install
npm run dev
```

## Auth

Both admin-api and dashboard use bearer auth.

- Header: `Authorization: Bearer <ADMIN_BEARER_TOKEN>`
- Default token from `.env.example`: `change-me`

## LLM Setup

Set in shell before starting admin-api:

```bash
export SPEC5_LLM_API_KEY="your-api-key"
export SPEC5_LLM_MODEL="claude-sonnet-4-20250514"
```

If no API key is set, manual review gracefully returns:

`AI summary unavailable — please review manually.`
