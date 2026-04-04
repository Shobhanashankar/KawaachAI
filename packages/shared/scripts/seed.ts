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
        INSERT INTO active_policies (policy_id, worker_id, h3_zone, status, daily_wage_inr)
        VALUES ($1, $2, $3, 'ACTIVE', $4)
        ON CONFLICT (policy_id) DO UPDATE
        SET worker_id = EXCLUDED.worker_id,
            h3_zone = EXCLUDED.h3_zone,
            status = EXCLUDED.status,
            daily_wage_inr = EXCLUDED.daily_wage_inr,
            updated_at = now()
      `,
      [policyId, workerId, zone.h3, 400 + i * 10],
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
  logger.info({ zones: zones.length, workers: 10, policies: 10 }, 'Seed completed');
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
