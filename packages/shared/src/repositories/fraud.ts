import { query } from '../db';
import { FraudRingSnapshot, WorkerTelemetryProfile } from '../types';

interface WorkerTelemetryRow {
  worker_id: string;
  mock_provider: boolean;
  allow_mock_location: boolean;
  lat: number;
  lng: number;
  hdop: number;
  accelerometer_variance: number;
  barometric_pressure_hpa: number;
  gnss_cn0: number;
  gnss_agc: number;
  gps_timestamp_ms: number;
  ntp_timestamp_ms: number;
  battery_drain_z_score: number;
  speed_samples: string[];
  bssids: string[];
  cell_tower_ids: string[];
  recent_app_activity_in_zone: boolean;
  shared_network_flag: boolean;
}

export const getWorkerTelemetryProfile = async (
  workerId: string,
): Promise<WorkerTelemetryProfile | null> => {
  const result = await query<WorkerTelemetryRow>(
    `
      SELECT
        worker_id,
        mock_provider,
        allow_mock_location,
        lat::float8 AS lat,
        lng::float8 AS lng,
        hdop::float8 AS hdop,
        accelerometer_variance::float8 AS accelerometer_variance,
        barometric_pressure_hpa::float8 AS barometric_pressure_hpa,
        gnss_cn0::float8 AS gnss_cn0,
        gnss_agc::float8 AS gnss_agc,
        gps_timestamp_ms,
        ntp_timestamp_ms,
        battery_drain_z_score::float8 AS battery_drain_z_score,
        speed_samples,
        bssids,
        cell_tower_ids,
        recent_app_activity_in_zone,
        shared_network_flag
      FROM worker_telemetry_profiles
      WHERE worker_id = $1
      LIMIT 1
    `,
    [workerId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    worker_id: row.worker_id,
    mock_provider: row.mock_provider,
    allow_mock_location: row.allow_mock_location,
    lat: row.lat,
    lng: row.lng,
    hdop: row.hdop,
    accelerometer_variance: row.accelerometer_variance,
    barometric_pressure_hpa: row.barometric_pressure_hpa,
    gnss_cn0: row.gnss_cn0,
    gnss_agc: row.gnss_agc,
    gps_timestamp_ms: Number(row.gps_timestamp_ms),
    ntp_timestamp_ms: Number(row.ntp_timestamp_ms),
    battery_drain_z_score: row.battery_drain_z_score,
    speed_samples: row.speed_samples.map((item) => Number(item)),
    bssids: row.bssids,
    cell_tower_ids: row.cell_tower_ids,
    recent_app_activity_in_zone: row.recent_app_activity_in_zone,
    shared_network_flag: row.shared_network_flag,
  };
};

export const upsertClaimBssids = async (
  claimId: string,
  bssidHashes: string[],
  claimedAtIso: string,
): Promise<void> => {
  if (!bssidHashes.length) return;

  for (const bssidHash of bssidHashes) {
    await query(
      `
        INSERT INTO claim_bssids (claim_id, bssid_hash, claimed_at)
        VALUES ($1::uuid, $2, $3::timestamptz)
        ON CONFLICT (claim_id, bssid_hash) DO NOTHING
      `,
      [claimId, bssidHash, claimedAtIso],
    );
  }
};

export const getBssidProximityWorkers = async (
  bssidHashes: string[],
  eventId: string,
): Promise<string[]> => {
  if (!bssidHashes.length) return [];

  const result = await query<{ worker_id: string }>(
    `
      SELECT DISTINCT c.worker_id
      FROM claim_bssids cb
      JOIN claims c ON c.id = cb.claim_id
      WHERE cb.bssid_hash = ANY($1::text[])
        AND c.event_id = $2::uuid
        AND cb.claimed_at > now() - interval '10 minutes'
    `,
    [bssidHashes, eventId],
  );

  return result.rows.map((row) => row.worker_id);
};

interface RingRow {
  bssid_hash: string;
  worker_ids: string[];
  claim_ids: string[];
  worker_count: number;
  last_seen_at: string;
}

export const getActiveFraudRings = async (): Promise<FraudRingSnapshot[]> => {
  const result = await query<RingRow>(
    `
      SELECT
        cb.bssid_hash,
        ARRAY_AGG(DISTINCT c.worker_id) AS worker_ids,
        ARRAY_AGG(DISTINCT c.id::text) AS claim_ids,
        COUNT(DISTINCT c.worker_id)::int AS worker_count,
        MAX(cb.claimed_at)::text AS last_seen_at
      FROM claim_bssids cb
      JOIN claims c ON c.id = cb.claim_id
      WHERE cb.claimed_at > now() - interval '1 hour'
      GROUP BY cb.bssid_hash
      HAVING COUNT(DISTINCT c.worker_id) >= 3
      ORDER BY MAX(cb.claimed_at) DESC
    `,
  );

  return result.rows.map((row) => ({
    bssid_hash: row.bssid_hash,
    worker_ids: row.worker_ids,
    claim_ids: row.claim_ids,
    worker_count: Number(row.worker_count),
    last_seen_at: row.last_seen_at,
  }));
};

interface LayerStatsRow {
  status: string;
  total: number;
  avg_latency_ms: number | null;
}

export const getFraudLayerStats = async (): Promise<LayerStatsRow[]> => {
  const result = await query<LayerStatsRow>(
    `
      SELECT
        status,
        COUNT(*)::int AS total,
        AVG(fraud_latency_ms)::float8 AS avg_latency_ms
      FROM claims
      GROUP BY status
      ORDER BY status
    `,
  );

  return result.rows;
};
