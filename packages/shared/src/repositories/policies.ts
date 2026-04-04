import { ActivePolicy } from '../types';
import { query } from '../db';

export const getActivePoliciesByZone = async (zoneH3: string): Promise<ActivePolicy[]> => {
  const result = await query<ActivePolicy>(
    `
      SELECT
        policy_id,
        worker_id,
        h3_zone,
        status,
        daily_wage_inr::float8 AS daily_wage_inr,
        saferider_tier
      FROM active_policies
      WHERE h3_zone = $1 AND status = 'ACTIVE'
      ORDER BY policy_id ASC
    `,
    [zoneH3],
  );

  return result.rows;
};
