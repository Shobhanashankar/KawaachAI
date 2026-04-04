import { ActiveZone } from '../types';
import { query } from '../db';

export const getActiveZones = async (): Promise<ActiveZone[]> => {
  const result = await query<ActiveZone>(
    `
      SELECT h3_index, city, lat::float8 AS lat, lng::float8 AS lng, risk_multiplier::float8 AS risk_multiplier
      FROM active_zones
      ORDER BY city ASC
    `,
  );
  return result.rows;
};

export const getZoneByH3 = async (h3Index: string): Promise<ActiveZone | null> => {
  const result = await query<ActiveZone>(
    `
      SELECT h3_index, city, lat::float8 AS lat, lng::float8 AS lng, risk_multiplier::float8 AS risk_multiplier
      FROM active_zones
      WHERE h3_index = $1
      LIMIT 1
    `,
    [h3Index],
  );

  return result.rows[0] ?? null;
};
