import { pool } from '../src/db';
import { logger } from '../src/logger';

const zones = [
  { h3: '8828308281fffff', city: 'Bengaluru', lat: 12.9716, lng: 77.5946, risk: 1.2 },
  { h3: '882a100d63fffff', city: 'Mumbai', lat: 19.076, lng: 72.8777, risk: 1.3 },
  { h3: '882a1340a3fffff', city: 'Delhi', lat: 28.6139, lng: 77.209, risk: 1.1 },
  { h3: '882b359061fffff', city: 'Hyderabad', lat: 17.385, lng: 78.4867, risk: 1.0 },
];

const run = async (): Promise<void> => {
  await pool.query('BEGIN');

  for (const zone of zones) {
    await pool.query(
      `
        INSERT INTO active_zones (h3_index, city, lat, lng, risk_multiplier)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (h3_index) DO UPDATE
        SET city = EXCLUDED.city,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            risk_multiplier = EXCLUDED.risk_multiplier
      `,
      [zone.h3, zone.city, zone.lat, zone.lng, zone.risk],
    );
  }

  for (let i = 1; i <= 10; i += 1) {
    const workerId = `worker-${i}`;
    const policyId = `policy-${i}`;
    const zone = zones[(i - 1) % zones.length];
    const saferiderTier = ((i - 1) % 5) + 1;

    await pool.query(
      `
        INSERT INTO workers (worker_id, name, city)
        VALUES ($1, $2, $3)
        ON CONFLICT (worker_id) DO UPDATE
        SET name = EXCLUDED.name,
            city = EXCLUDED.city
      `,
      [workerId, `Worker ${i}`, zone.city],
    );

    await pool.query(
      `
        INSERT INTO active_policies (policy_id, worker_id, h3_zone, status, daily_wage_inr, saferider_tier)
        VALUES ($1, $2, $3, 'ACTIVE', $4, $5)
        ON CONFLICT (policy_id) DO UPDATE
        SET worker_id = EXCLUDED.worker_id,
            h3_zone = EXCLUDED.h3_zone,
            status = EXCLUDED.status,
            daily_wage_inr = EXCLUDED.daily_wage_inr,
            saferider_tier = EXCLUDED.saferider_tier,
            updated_at = now()
      `,
      [policyId, workerId, zone.h3, 400 + i * 10, saferiderTier],
    );

    const ringBssids = ['bssid_ring_blr_a', 'bssid_ring_blr_b'];
    const defaultBssid = [`bssid_${zone.city.toLowerCase()}_${i}`];
    const bssids = i === 1 || i === 5 || i === 9 ? ringBssids : defaultBssid;

    const telemetryLat = i === 10 ? zone.lat + 0.15 : zone.lat + (i % 3) * 0.0001;
    const telemetryLng = i === 10 ? zone.lng + 0.15 : zone.lng + (i % 2) * 0.0001;
    const mockProvider = i === 9;
    const allowMockLocation = i === 9;
    const accelerometerVariance = i === 9 ? 0.02 : 0.31;
    const gnssCn0 = i === 2 ? 48 : 34;
    const gnssAgc = i === 2 ? -12 : -2;
    const speedSamples = i === 9 ? [0.1, 0.1, 0.1, 0.12] : [3.2, 5.1, 4.7, 6.2, 4.1];

    await pool.query(
      `
        INSERT INTO worker_telemetry_profiles (
          worker_id,
          mock_provider,
          allow_mock_location,
          lat,
          lng,
          hdop,
          accelerometer_variance,
          barometric_pressure_hpa,
          gnss_cn0,
          gnss_agc,
          gps_timestamp_ms,
          ntp_timestamp_ms,
          battery_drain_z_score,
          speed_samples,
          bssids,
          cell_tower_ids,
          recent_app_activity_in_zone,
          shared_network_flag,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14::numeric[],
          $15::text[],
          $16::text[],
          $17,
          $18,
          now()
        )
        ON CONFLICT (worker_id) DO UPDATE
        SET mock_provider = EXCLUDED.mock_provider,
            allow_mock_location = EXCLUDED.allow_mock_location,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            hdop = EXCLUDED.hdop,
            accelerometer_variance = EXCLUDED.accelerometer_variance,
            barometric_pressure_hpa = EXCLUDED.barometric_pressure_hpa,
            gnss_cn0 = EXCLUDED.gnss_cn0,
            gnss_agc = EXCLUDED.gnss_agc,
            gps_timestamp_ms = EXCLUDED.gps_timestamp_ms,
            ntp_timestamp_ms = EXCLUDED.ntp_timestamp_ms,
            battery_drain_z_score = EXCLUDED.battery_drain_z_score,
            speed_samples = EXCLUDED.speed_samples,
            bssids = EXCLUDED.bssids,
            cell_tower_ids = EXCLUDED.cell_tower_ids,
            recent_app_activity_in_zone = EXCLUDED.recent_app_activity_in_zone,
            shared_network_flag = EXCLUDED.shared_network_flag,
            updated_at = now()
      `,
      [
        workerId,
        mockProvider,
        allowMockLocation,
        telemetryLat,
        telemetryLng,
        4 + (i % 3),
        accelerometerVariance,
        zone.city === 'Mumbai' ? 998 : 1006,
        gnssCn0,
        gnssAgc,
        Date.now(),
        Date.now() + (i === 2 ? 9000 : 400),
        i === 9 ? 1.4 : 0.3,
        speedSamples,
        bssids,
        [`tower_${zone.city.toLowerCase()}_${(i % 3) + 1}`],
        i !== 8,
        i === 1 || i === 5 || i === 9,
      ],
    );
  }

  const exclusionFlags = ['war', 'pandemic_WHO_declared', 'government_force_majeure'];
  for (const key of exclusionFlags) {
    await pool.query(
      `
        INSERT INTO exclusion_flags (key, active, reason, set_by, set_at)
        VALUES ($1, false, NULL, 'seed', now())
        ON CONFLICT (key) DO UPDATE
        SET active = EXCLUDED.active,
            reason = EXCLUDED.reason,
            set_by = EXCLUDED.set_by,
            set_at = EXCLUDED.set_at
      `,
      [key],
    );
  }

  await pool.query('COMMIT');
  logger.info({ zones: zones.length, workers: 10, policies: 10, telemetry_profiles: 10 }, 'Seed completed');
};

run()
  .catch(async (error) => {
    await pool.query('ROLLBACK');
    logger.error({ err: error }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
