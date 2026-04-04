import { query } from './db';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const httpRequestCounter = new Counter({
  name: 'kawaachai_admin_http_requests_total',
  help: 'Total HTTP requests handled by spec5-admin-api',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

const httpRequestDuration = new Histogram({
  name: 'kawaachai_admin_http_request_duration_ms',
  help: 'HTTP request latency in milliseconds for spec5-admin-api',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
  registers: [metricsRegistry],
});

const claimsByStatusGauge = new Gauge({
  name: 'kawaachai_claims_total',
  help: 'Claim counts grouped by status',
  labelNames: ['status'],
  registers: [metricsRegistry],
});

const claimLatencyGauge = new Gauge({
  name: 'kawaachai_claim_latency_ms',
  help: 'Claim latency quantiles in milliseconds',
  labelNames: ['quantile'],
  registers: [metricsRegistry],
});

const fraudEngineLatencyGauge = new Gauge({
  name: 'kawaachai_fraud_engine_latency_ms',
  help: 'Fraud engine latency quantiles in milliseconds',
  labelNames: ['quantile'],
  registers: [metricsRegistry],
});

const fraudScoreHistogramGauge = new Gauge({
  name: 'kawaachai_fraud_score_histogram',
  help: 'Fraud score histogram-like counts by bucket',
  labelNames: ['bucket'],
  registers: [metricsRegistry],
});

const kafkaLagGauge = new Gauge({
  name: 'kawaachai_kafka_consumer_lag',
  help: 'Kafka consumer lag by topic (0 when unavailable)',
  labelNames: ['topic'],
  registers: [metricsRegistry],
});

export const recordHttpMetrics = (
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
): void => {
  const labels = {
    method,
    route,
    status_code: String(statusCode),
  };

  httpRequestCounter.inc(labels, 1);
  httpRequestDuration.observe(labels, durationMs);
};

export const refreshBusinessMetrics = async (): Promise<void> => {
  const claimCounts = await query<{ status: string; total: number }>(
    `
      SELECT status, COUNT(*)::int AS total
      FROM claims
      GROUP BY status
    `,
  );

  claimsByStatusGauge.reset();
  for (const row of claimCounts.rows) {
    claimsByStatusGauge.set({ status: row.status }, Number(row.total));
  }

  const claimLatency = await query<{
    p50_ms: number | null;
    p95_ms: number | null;
    p99_ms: number | null;
    fraud_p95_ms: number | null;
  }>(
    `
      SELECT
        percentile_cont(0.50) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000
        )::float8 AS p50_ms,
        percentile_cont(0.95) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000
        )::float8 AS p95_ms,
        percentile_cont(0.99) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000
        )::float8 AS p99_ms,
        percentile_cont(0.95) WITHIN GROUP (
          ORDER BY fraud_latency_ms
        )::float8 AS fraud_p95_ms
      FROM claims
      WHERE created_at >= now() - interval '30 days'
    `,
  );

  const latencyRow = claimLatency.rows[0];
  claimLatencyGauge.set({ quantile: 'p50' }, Number(latencyRow?.p50_ms ?? 0));
  claimLatencyGauge.set({ quantile: 'p95' }, Number(latencyRow?.p95_ms ?? 0));
  claimLatencyGauge.set({ quantile: 'p99' }, Number(latencyRow?.p99_ms ?? 0));

  fraudEngineLatencyGauge.set({ quantile: 'p95' }, Number(latencyRow?.fraud_p95_ms ?? 0));

  const fraudHistogram = await query<{
    bucket: string;
    total: number;
  }>(
    `
      SELECT *
      FROM (
        SELECT '0.0-0.2' AS bucket, COUNT(*)::int AS total FROM claims WHERE fraud_score >= 0 AND fraud_score < 0.2
        UNION ALL
        SELECT '0.2-0.4' AS bucket, COUNT(*)::int AS total FROM claims WHERE fraud_score >= 0.2 AND fraud_score < 0.4
        UNION ALL
        SELECT '0.4-0.6' AS bucket, COUNT(*)::int AS total FROM claims WHERE fraud_score >= 0.4 AND fraud_score < 0.6
        UNION ALL
        SELECT '0.6-0.8' AS bucket, COUNT(*)::int AS total FROM claims WHERE fraud_score >= 0.6 AND fraud_score < 0.8
        UNION ALL
        SELECT '0.8-1.0' AS bucket, COUNT(*)::int AS total FROM claims WHERE fraud_score >= 0.8 AND fraud_score <= 1.0
      ) bins
    `,
  );

  fraudScoreHistogramGauge.reset();
  for (const row of fraudHistogram.rows) {
    fraudScoreHistogramGauge.set({ bucket: row.bucket }, Number(row.total));
  }

  kafkaLagGauge.set({ topic: 'disruption-events' }, 0);
};
